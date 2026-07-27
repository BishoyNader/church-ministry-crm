import { createClient } from "@/lib/supabase/server";

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function signUpWithEmail(fullNameAr: string, fullNameEn: string | undefined, email: string, password: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name_ar: fullNameAr,
        full_name_en: fullNameEn,
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
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
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
