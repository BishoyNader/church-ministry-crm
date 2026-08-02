import type { Json } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { sendNotification } from "@/features/notifications/services/notification.service";

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: preProfile } = await admin
    .from("profiles")
    .select("is_active")
    .eq("email", email)
    .maybeSingle();

  if (preProfile && !preProfile.is_active) {
    return { success: false, error: "ACCOUNT_INACTIVE" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const userId = data.user?.id;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active, church_id")
      .eq("id", userId)
      .single();

    if (!profile) {
      await supabase.auth.signOut();
      return { success: false, error: "PROFILE_NOT_FOUND" };
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      return { success: false, error: "ACCOUNT_INACTIVE" };
    }

    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId);

    await writeAuditLog(supabase, "login", "session", userId);
  }

  return { success: true, data };
}

export type ExistingChurchRegistrationResult = {
  success: boolean;
  error?: string;
  isProd?: boolean;
};

/**
 * registerExistingChurchUser — Phase 3C existing-church registration
 * (REGISTRATION_WORKFLOW_SPEC §3.2). Free-text church creation and automatic
 * super_admin grants are removed. The new user gets a pending servant record
 * and NO role grants; approval is a separate super_admin action.
 */
export async function registerExistingChurchUser(
  churchId: string,
  fullNameAr: string,
  fullNameEn: string | undefined,
  email: string,
  phone: string | undefined,
  password: string,
): Promise<ExistingChurchRegistrationResult> {
  const admin = createAdminClient();
  const isProd = process.env.NODE_ENV === "production";

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone?.trim() || null;

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    return { success: false, error: "EMAIL_ALREADY_REGISTERED" };
  }

  const { data: church } = await admin
    .from("churches")
    .select("id, is_active, deleted_at")
    .eq("id", churchId)
    .maybeSingle();

  if (!church || !church.is_active || church.deleted_at) {
    return { success: false, error: "CHURCH_NOT_AVAILABLE" };
  }

  const { data: authData, error: authError } = isProd
    ? await (await createClient()).auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name_ar: fullNameAr,
            full_name_en: fullNameEn ?? null,
          },
        },
      })
    : await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name_ar: fullNameAr,
          full_name_en: fullNameEn ?? null,
        },
      });

  if (authError) {
    return { success: false, error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { success: false, error: "User creation failed." };
  }

  try {
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      church_id: church.id,
      email: normalizedEmail,
      full_name_ar: fullNameAr,
      full_name_en: fullNameEn ?? null,
      phone: normalizedPhone,
      preferred_locale: "ar",
    });

    if (profileError) {
      throw new Error("Failed to create user profile.");
    }

    const { error: servantError } = await admin.from("servants").insert({
      id: userId,
      church_id: church.id,
      approval_status: "pending",
    });

    if (servantError) {
      throw new Error("Failed to create pending servant record.");
    }

    await writeRegistrationAudit(admin, church.id, userId, "servant", {
      approval_status: "pending",
    });
    await writeRegistrationAudit(admin, church.id, userId, "registration_request", {
      email: normalizedEmail,
      church_id: church.id,
    });

    await notifyChurchSuperAdmins(church.id, fullNameAr, normalizedEmail, normalizedPhone, userId);

    return { success: true, isProd };
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Registration failed.",
    };
  }
}

async function writeRegistrationAudit(
  admin: ReturnType<typeof createAdminClient>,
  churchId: string,
  userId: string,
  entityType: string,
  newValues: Json | null,
) {
  try {
    await admin.from("audit_logs").insert({
      church_id: churchId,
      actor_id: userId,
      action: "create",
      entity_type: entityType,
      entity_id: userId,
      old_values: null,
      new_values: newValues,
      metadata: { source: "registration" },
    });
  } catch (err) {
    console.error("[auth.service] Failed to write registration audit:", err);
  }
}

async function notifyChurchSuperAdmins(
  churchId: string,
  applicantName: string,
  email: string,
  phone: string | null,
  servantId: string,
) {
  try {
    const admin = createAdminClient();
    const { data: roles } = await admin
      .from("roles")
      .select("id")
      .eq("church_id", churchId)
      .eq("role_type", "super_admin");

    if (!roles?.length) return;

    const roleIds = roles.map((r) => r.id);
    const { data: superAdmins } = await admin
      .from("user_roles")
      .select("user_id")
      .in("role_id", roleIds)
      .is("end_date", null);

    if (!superAdmins?.length) return;

    const payload = {
      churchId,
      notificationType: "approval_required",
      titleAr: "طلب انضمام جديد",
      titleEn: "New registration request",
      bodyAr: `${applicantName} قدم طلب انضمام`,
      bodyEn: `${applicantName} submitted a registration request`,
      data: {
        type: "servant_registration",
        servant_id: servantId,
        applicant_name: applicantName,
        applicant_email: email,
        applicant_phone: phone,
        church_id: churchId,
        request_date: new Date().toISOString(),
      },
    } as const;

    for (const { user_id } of superAdmins) {
      await sendNotification({ ...payload, recipientId: user_id });
    }
  } catch (err) {
    console.error("[auth.service] Failed to notify super admins:", err);
  }
}

export async function sendPasswordReset(email: string, redirectTo: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function updatePassword(password: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function signOut() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("church_id")
      .eq("id", user.id)
      .single();

    if (profile) {
      await writeAuditLog(supabase, "logout", "session", user.id);
    }
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
