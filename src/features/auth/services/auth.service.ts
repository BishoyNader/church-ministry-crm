import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generateSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || `church-${Date.now()}`;
}

async function ensureUniqueSlug(
  admin: ReturnType<typeof createAdminClient>,
  baseSlug: string,
): Promise<string> {
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const { data } = await admin
      .from("churches")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!data) return candidate;

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}

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

    await supabase.from("audit_logs").insert({
      church_id: profile.church_id,
      user_id: userId,
      action: "login",
      entity_type: "session",
    });
  }

  return { success: true, data };
}

export async function signUpWithEmail(
  churchNameAr: string,
  churchNameEn: string | undefined,
  fullNameAr: string,
  fullNameEn: string | undefined,
  email: string,
  password: string,
) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name_ar: fullNameAr,
        full_name_en: fullNameEn,
      },
    },
  });

  if (authError) {
    return { success: false, error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { success: false, error: "User creation failed." };
  }

  const admin = createAdminClient();
  let churchId: string | null = null;

  try {
    const baseSlug = generateSlug(churchNameAr);
    const slug = await ensureUniqueSlug(admin, baseSlug);

    const { data: church, error: churchError } = await admin
      .from("churches")
      .insert({
        name_ar: churchNameAr,
        name_en: churchNameEn,
        slug,
      })
      .select("id")
      .single();

    if (churchError || !church) {
      throw new Error("Failed to create church.");
    }

    churchId = church.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      church_id: church.id,
      email,
      full_name_ar: fullNameAr,
      full_name_en: fullNameEn,
    });

    if (profileError) {
      throw new Error("Failed to create user profile.");
    }

    const { error: seedError } = await admin.rpc("seed_church_roles", {
      p_church_id: church.id,
    });

    if (seedError) {
      throw new Error("Failed to initialize church roles.");
    }

    const { data: superAdminRole } = await admin
      .from("roles")
      .select("id")
      .eq("church_id", church.id)
      .eq("role_type", "super_admin")
      .single();

    if (superAdminRole) {
      await admin.from("user_roles").insert({
        church_id: church.id,
        user_id: userId,
        role_id: superAdminRole.id,
      });
    }

    return { success: true, data: authData };
  } catch (error) {
    if (churchId) {
      await admin.from("churches").delete().eq("id", churchId);
    }
    await admin.auth.admin.deleteUser(userId);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Onboarding failed.",
    };
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
      await supabase.from("audit_logs").insert({
        church_id: profile.church_id,
        user_id: user.id,
        action: "logout",
        entity_type: "session",
      });
    }
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
