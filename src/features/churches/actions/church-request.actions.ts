"use server";

import { churchRequestSchema, type ChurchRequestFormValues } from "../schemas/church-request.schema";
import { submitChurchRequest } from "../services/church-request.service";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/features/notifications/services/notification.service";
import { assertRateLimit } from "@/lib/rate-limit";
import { ZodError } from "zod";

export type ChurchRequestActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof ChurchRequestFormValues, string>>;
};

async function notifyPlatformOwnersForChurchRequest(
  requestId: string,
  churchNameAr: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: role } = await admin
      .from("roles")
      .select("id")
      .eq("church_id", null)
      .eq("role_type", "platform_owner")
      .maybeSingle();

    if (!role?.id) {
      return;
    }

    const { data: grants } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role_id", role.id)
      .is("end_date", null);

    if (!grants?.length) {
      return;
    }

    const payload = {
      churchId: null,
      notificationType: "church_pending",
      titleAr: "طلب كنيسة جديد",
      titleEn: "New church request",
      bodyAr: `تم تقديم طلب جديد للكنيسة ${churchNameAr}`,
      bodyEn: `A new church request was submitted for ${churchNameAr}`,
      data: {
        type: "church_request",
        church_request_id: requestId,
        church_name: churchNameAr,
        request_date: new Date().toISOString(),
      },
    } as const;

    for (const { user_id } of grants) {
      await sendNotification({ ...payload, recipientId: user_id });
    }
  } catch {
    // Intentionally swallow notification delivery errors; business write is already committed.
  }
}

export async function submitChurchRequestAction(
  values: ChurchRequestFormValues,
): Promise<ChurchRequestActionResult> {
  const gate = await assertRateLimit({ scope: "church-request", limit: 3 });
  if (!gate.ok) {
    return {
      success: false,
      message: "Too many requests. Please wait a moment and try again.",
    };
  }

  try {
    churchRequestSchema.parse(values);
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

  const supabase = await createClient();
  const result = await submitChurchRequest(supabase, {
    churchNameAr: values.churchNameAr,
    catechistName: values.catechistName,
    applicantName: values.applicantName,
    email: values.email,
    phone: values.phone || null,
    notes: values.notes || null,
  });

  if (result.error) {
    return {
      success: false,
      message:
        result.error.code === "email_already_registered"
          ? "email_already_registered"
          : result.error.code === "request_already_pending"
            ? "request_already_pending"
            : result.error.code === "church_name_exists"
              ? "church_name_exists"
              : result.error.message,
    };
  }

  if (result.data) {
    await notifyPlatformOwnersForChurchRequest(result.data, values.churchNameAr.trim());
  }

  return { success: true };
}
