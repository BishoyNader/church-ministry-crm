import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RegistrationError,
  RegistrationFunctions,
  RpcResult,
  SubmitChurchRequestInput,
} from "@/types/registration";
import { toRegistrationError } from "@/types/registration";

type ServiceResult<T> = { data: T | null; error: RegistrationError | null };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type NormalizedChurchRequest = {
  p_church_name_ar: string;
  p_church_name_en: string | null;
  p_catechist_name: string;
  p_applicant_name: string;
  p_email: string;
  p_phone: string | null;
  p_notes: string | null;
};

type NormalizeResult =
  | { ok: true; data: NormalizedChurchRequest }
  | { ok: false; error: RegistrationError };

function normalize(input: SubmitChurchRequestInput): NormalizeResult {
  const churchNameAr = input.churchNameAr?.trim();
  const catechistName = input.catechistName?.trim();
  const applicantName = input.applicantName?.trim();
  const email = input.email?.trim();
  const churchNameEn = input.churchNameEn?.trim() || null;
  const phone = input.phone?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (!churchNameAr) {
    return { ok: false, error: { code: "church_name_required", message: "Church name is required." } };
  }
  if (!catechistName) {
    return { ok: false, error: { code: "catechist_name_required", message: "Catechist name is required." } };
  }
  if (!applicantName) {
    return { ok: false, error: { code: "applicant_name_required", message: "Applicant name is required." } };
  }
  if (!email) {
    return { ok: false, error: { code: "email_required", message: "Email is required." } };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: { code: "email_required", message: "Please provide a valid email." } };
  }

  return {
    ok: true,
    data: {
      p_church_name_ar: churchNameAr,
      p_church_name_en: churchNameEn,
      p_catechist_name: catechistName,
      p_applicant_name: applicantName,
      p_email: email.toLowerCase(),
      p_phone: phone,
      p_notes: notes,
    },
  };
}

/**
 * submit_church_request(...) — public new-church request submission (023 S11-4).
 * Dedupes server-side against profiles.email, pending church_requests, and
 * existing church names. Works for anon and authenticated callers.
 */
export async function submitChurchRequest(
  supabase: SupabaseClient,
  input: SubmitChurchRequestInput,
): Promise<ServiceResult<string>> {
  const validated = normalize(input);
  if (!validated.ok) {
    return { data: null, error: validated.error };
  }

  try {
    const result = (await supabase.rpc<
      "submit_church_request",
      RegistrationFunctions["submit_church_request"]["Args"]
    >("submit_church_request", validated.data)) as unknown as RpcResult<string>;

    if (result.error) {
      return { data: null, error: toRegistrationError(result.error) };
    }

    return { data: result.data ?? null, error: null };
  } catch {
    return { data: null, error: { code: "unknown", message: "Failed to submit request." } };
  }
}
