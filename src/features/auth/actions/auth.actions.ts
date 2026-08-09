"use server";

import { loginSchema, signupSchema, forgotPasswordSchema } from "../schemas/auth.schema";
import type { ForgotPasswordFormValues, LoginFormValues, SignupFormValues } from "../types/auth.types";
import { registerExistingChurchUser, sendPasswordReset, signInWithEmail, signOut as signOutService } from "../services/auth.service";
import { getMyAccessState } from "../services/access.service";
import { createClient } from "@/lib/supabase/server";
import { assertRateLimit } from "@/lib/rate-limit";
import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";

export type AuthActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof LoginFormValues | keyof SignupFormValues | keyof ForgotPasswordFormValues, string>>;
  redirectTo?: string;
};

export async function loginAction(values: LoginFormValues, locale: string): Promise<AuthActionResult> {
  const gate = await assertRateLimit({ scope: "login", limit: 10 });
  if (!gate.ok) {
    return {
      success: false,
      message: "Too many attempts. Please wait a moment and try again.",
    };
  }

  try {
    loginSchema.parse(values);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path[0] as string, issue.message]),
        ),
      };
    }
    throw error;
  }

  const result = await signInWithEmail(values.email, values.password);

  if (!result.success) {
    if (result.error === "ACCOUNT_INACTIVE" || result.error === "PROFILE_NOT_FOUND") {
      const t = await getTranslations({ locale, namespace: "auth" });
      const message =
        result.error === "ACCOUNT_INACTIVE"
          ? t("login.accountInactive")
          : t("login.profileNotFound");
      return { success: false, message };
    }
    return { success: false, message: result.error ?? "Unable to sign in." };
  }

  const access = await getMyAccessState(await createClient());
  const hasAccess =
    access.data?.is_active &&
    access.data.servant_approval_status === "approved" &&
    access.data.has_roles;

  return {
    success: true,
    message: "Signed in successfully.",
    redirectTo: hasAccess ? `/${locale}/dashboard` : `/${locale}/pending-approval`,
  };
}

export async function signupAction(values: SignupFormValues, locale: string): Promise<AuthActionResult> {
  const gate = await assertRateLimit({ scope: "signup", limit: 5 });
  if (!gate.ok) {
    return {
      success: false,
      message: "Too many attempts. Please wait a moment and try again.",
    };
  }

  try {
    signupSchema.parse(values);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path[0] as string, issue.message]),
        ),
      };
    }
    throw error;
  }

  const result = await registerExistingChurchUser(
    values.churchId,
    values.fullNameAr,
    values.fullNameEn,
    values.email,
    values.phone,
    values.password,
  );

  if (!result.success) {
    if (result.error === "EMAIL_ALREADY_REGISTERED" || result.error === "CHURCH_NOT_AVAILABLE") {
      const t = await getTranslations({ locale, namespace: "auth" });
      const message =
        result.error === "EMAIL_ALREADY_REGISTERED"
          ? t("signup.emailAlreadyRegistered")
          : t("signup.churchNotAvailable");
      return { success: false, message };
    }
    return { success: false, message: result.error ?? "Unable to create account." };
  }

  return {
    success: true,
    message: "Registration submitted for approval.",
    redirectTo: result.isProd
      ? `/${locale}/login?signup=pending`
      : `/${locale}/pending-approval`,
  };
}

export async function forgotPasswordAction(values: ForgotPasswordFormValues, locale: string): Promise<AuthActionResult> {
  const gate = await assertRateLimit({ scope: "forgot-password", limit: 5 });
  if (!gate.ok) {
    return {
      success: false,
      message: "Too many attempts. Please wait a moment and try again.",
    };
  }

  try {
    forgotPasswordSchema.parse(values);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path[0] as string, issue.message]),
        ),
      };
    }
    throw error;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = `${appUrl}/${locale}/reset-password`;

  const result = await sendPasswordReset(values.email, redirectTo);

  if (!result.success) {
    return { success: false, message: result.error ?? "Unable to send reset email." };
  }

  return { success: true, message: "Password reset email sent. Please check your inbox." };
}

export async function logoutAction(locale: string): Promise<AuthActionResult> {
  const result = await signOutService();

  if (!result.success) {
    return { success: false, message: result.error ?? "Unable to sign out." };
  }

  return {
    success: true,
    message: "Signed out successfully.",
    redirectTo: `/${locale}/login`,
  };
}
