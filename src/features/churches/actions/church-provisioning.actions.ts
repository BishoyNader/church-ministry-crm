"use server";

import { createClient } from "@/lib/supabase/server";
import { provisionChurch, createChurchSuperAdmin } from "../services/provisioning.service";

export async function provisionChurchAction(input: {
  churchNameAr: string;
  churchNameEn?: string;
  slug: string;
  contactEmail?: string;
  contactPhone?: string;
  addressAr?: string;
  authUserId: string;
  fullNameAr: string;
  fullNameEn?: string;
  email: string;
  phone?: string;
}) {
  try {
    const supabase = createClient();
    const result = await provisionChurch(supabase as unknown as Parameters<typeof provisionChurch>[0], input);

    if (!result.data) {
      return { success: false, message: result.error ?? "Failed to provision church." };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, message: "Failed to provision church." };
  }
}

export async function createChurchSuperAdminAction(input: {
  churchId: string;
  authUserId: string;
  fullNameAr: string;
  fullNameEn?: string;
  email: string;
  phone?: string;
}) {
  try {
    const supabase = createClient();
    const result = await createChurchSuperAdmin(supabase as unknown as Parameters<typeof createChurchSuperAdmin>[0], input);

    if (!result.data) {
      return { success: false, message: result.error ?? "Failed to create church super admin." };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, message: "Failed to create church super admin." };
  }
}
