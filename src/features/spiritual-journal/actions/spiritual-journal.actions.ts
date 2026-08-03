"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  createSpiritualJournalSchema,
  updateSpiritualJournalSchema,
  uuidParamSchema,
} from "../schemas/spiritual-journal.schema";
import type {
  CreateSpiritualJournalFormValues,
  UpdateSpiritualJournalFormValues,
} from "../schemas/spiritual-journal.schema";
import type {
  SpiritualJournalEntry,
  SpiritualJournalListParams,
  SpiritualJournalListResult,
} from "../types/spiritual-journal.types";
import * as spiritualJournalService from "../services/spiritual-journal.service";
import { ZodError } from "zod";

export type SpiritualJournalActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  data?: T;
};

function handleZodError(error: unknown): SpiritualJournalActionResult<never> {
  if (error instanceof ZodError) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    };
  }
  return {
    success: false,
    message: "An unexpected validation error occurred.",
  };
}

function validateId(id: string, label: string): SpiritualJournalActionResult<never> | null {
  const result = uuidParamSchema.safeParse(id);
  if (!result.success) {
    return { success: false, message: `Invalid ${label}.` };
  }
  return null;
}

export async function listSpiritualJournalEntriesAction(
  filters?: SpiritualJournalListParams,
): Promise<SpiritualJournalActionResult<SpiritualJournalListResult>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SPIRITUAL_READ))) {
    return { success: false, message: "You do not have permission to view spiritual journal entries." };
  }
  const result = await spiritualJournalService.listSpiritualJournalEntries(supabase, user.id, filters);
  if (result.error) return { success: false, message: result.error };
  return { success: true, data: result.data ?? undefined };
}

export async function getSpiritualJournalEntryAction(
  entryId: string,
): Promise<SpiritualJournalActionResult<SpiritualJournalEntry>> {
  const idError = validateId(entryId, "entry ID");
  if (idError) return idError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SPIRITUAL_READ))) {
    return { success: false, message: "You do not have permission to view spiritual journal entries." };
  }
  const result = await spiritualJournalService.getSpiritualJournalEntryById(supabase, entryId, user.id);
  if (result.error) return { success: false, message: result.error };
  return { success: true, data: result.data ?? undefined };
}

export async function createSpiritualJournalEntryAction(
  values: CreateSpiritualJournalFormValues,
): Promise<SpiritualJournalActionResult<{ id: string }>> {
  try {
    createSpiritualJournalSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SPIRITUAL_CREATE))) {
    return { success: false, message: "You do not have permission to create spiritual journal entries." };
  }
  const result = await spiritualJournalService.createSpiritualJournalEntry(supabase, user.id, {
    entryDate: values.entryDate,
    prayerCompleted: values.prayerCompleted,
    bibleReading: values.bibleReading,
    liturgyAttendance: values.liturgyAttendance,
    confession: values.confession,
    spiritualNotes: values.spiritualNotes,
  });
  if (result.error) return { success: false, message: result.error };
  if (result.data) {
    await writeAuditLog(supabase, "create", "spiritual_journal_entry", result.data.id, undefined, {
      entry_date: values.entryDate,
    });
  }
  return { success: true, message: "Spiritual journal entry created.", data: result.data ?? undefined };
}

export async function updateSpiritualJournalEntryAction(
  entryId: string,
  values: UpdateSpiritualJournalFormValues,
): Promise<SpiritualJournalActionResult> {
  const idError = validateId(entryId, "entry ID");
  if (idError) return idError;
  try {
    updateSpiritualJournalSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SPIRITUAL_CREATE))) {
    return { success: false, message: "You do not have permission to update spiritual journal entries." };
  }
  const existing = await spiritualJournalService.getSpiritualJournalEntryById(supabase, entryId, user.id);
  const oldValues = existing.data ?? undefined;
  const result = await spiritualJournalService.updateSpiritualJournalEntry(supabase, entryId, user.id, {
    prayerCompleted: values.prayerCompleted,
    bibleReading: values.bibleReading,
    liturgyAttendance: values.liturgyAttendance,
    confession: values.confession,
    spiritualNotes: values.spiritualNotes,
  });
  if (result.error) return { success: false, message: result.error };
  await writeAuditLog(supabase, "update", "spiritual_journal_entry", entryId, oldValues, values);
  return { success: true, message: "Spiritual journal entry updated." };
}

export async function deleteSpiritualJournalEntryAction(
  entryId: string,
): Promise<SpiritualJournalActionResult> {
  const idError = validateId(entryId, "entry ID");
  if (idError) return idError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SPIRITUAL_CREATE))) {
    return { success: false, message: "You do not have permission to delete spiritual journal entries." };
  }
  const existing = await spiritualJournalService.getSpiritualJournalEntryById(supabase, entryId, user.id);
  const oldValues = existing.data ?? undefined;
  const result = await spiritualJournalService.deleteSpiritualJournalEntry(supabase, entryId, user.id);
  if (result.error) return { success: false, message: result.error };
  await writeAuditLog(supabase, "delete", "spiritual_journal_entry", entryId, oldValues);
  return { success: true, message: "Spiritual journal entry deleted." };
}