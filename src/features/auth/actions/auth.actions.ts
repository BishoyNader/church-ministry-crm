"use server";

import { loginSchema, signupSchema, forgotPasswordSchema } from "../schemas/auth.schema";
import type { ForgotPasswordFormValues, LoginFormValues, SignupFormValues } from "../types/auth.types";
import { sendPasswordReset, signInWithEmail, signOut as signOutService, signUpWithEmail } from "../services/auth.service";
import { ZodError } from "zod";

export type AuthActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof LoginFormValues | keyof SignupFormValues | keyof ForgotPasswordFormValues, string>>;
  redirectTo?: string;
};

export async function loginAction(values: LoginFormValues, locale: string): Promise<AuthActionResult> {
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
    return { success: false, message: result.error ?? "Unable to sign in." };
  }

  return {
    success: true,
    message: "Signed in successfully.",
    redirectTo: `/${locale}`,
  };
}

export async function signupAction(values: SignupFormValues, locale: string): Promise<AuthActionResult> {
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

  const result = await signUpWithEmail(values.fullNameAr, values.fullNameEn, values.email, values.password);

  if (!result.success) {
    return { success: false, message: result.error ?? "Unable to create account." };
  }

  return {
    success: true,
    message: "Account created. Please check your inbox to confirm your email.",
    redirectTo: `/${locale}/login?signup=success`,
  };
}

export async function forgotPasswordAction(values: ForgotPasswordFormValues, locale: string): Promise<AuthActionResult> {
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
