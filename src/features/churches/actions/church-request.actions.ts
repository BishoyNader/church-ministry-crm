"use server";

import { churchRequestSchema, type ChurchRequestFormValues } from "../schemas/church-request.schema";
import { submitChurchRequest } from "../services/church-request.service";
import { createClient } from "@/lib/supabase/server";
import { ZodError } from "zod";

export type ChurchRequestActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof ChurchRequestFormValues, string>>;
};

export async function submitChurchRequestAction(
  values: ChurchRequestFormValues,
): Promise<ChurchRequestActionResult> {
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
    churchNameEn: null,
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

  return { success: true };
}
