import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SpiritualJournalEntry,
  SpiritualJournalListParams,
  SpiritualJournalListResult,
  CreateSpiritualJournalInput,
  UpdateSpiritualJournalInput,
} from "../types/spiritual-journal.types";

type ServiceResult<T> = { data: T | null; error: string | null };

function mapRowToEntry(row: {
  id: string;
  church_id: string;
  servant_id: string;
  entry_date: string;
  prayer_completed: boolean;
  bible_reading: boolean;
  liturgy_attendance: boolean;
  confession: boolean;
  spiritual_notes: string | null;
  created_at: string;
  updated_at: string;
}): SpiritualJournalEntry {
  return {
    id: row.id,
    churchId: row.church_id,
    servantId: row.servant_id,
    entryDate: row.entry_date,
    prayerCompleted: row.prayer_completed,
    bibleReading: row.bible_reading,
    liturgyAttendance: row.liturgy_attendance,
    confession: row.confession,
    spiritualNotes: row.spiritual_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSpiritualJournalEntries(
  supabase: SupabaseClient,
  servantId: string,
  filters?: SpiritualJournalListParams,
): Promise<ServiceResult<SpiritualJournalListResult>> {
  try {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("spiritual_journal_entries")
      .select("*", { count: "exact" })
      .eq("servant_id", servantId)
      .order("entry_date", { ascending: false });

    if (filters?.fromDate) {
      query = query.gte("entry_date", filters.fromDate);
    }

    if (filters?.toDate) {
      query = query.lte("entry_date", filters.toDate);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return { data: null, error: error.message };
    }

    const entries = (data ?? []).map((row) => mapRowToEntry(row as Parameters<typeof mapRowToEntry>[0]));

    return {
      data: {
        data: entries,
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load spiritual journal entries." };
  }
}

export async function getSpiritualJournalEntryById(
  supabase: SupabaseClient,
  entryId: string,
  servantId: string,
): Promise<ServiceResult<SpiritualJournalEntry>> {
  try {
    const { data, error } = await supabase
      .from("spiritual_journal_entries")
      .select("*")
      .eq("id", entryId)
      .eq("servant_id", servantId)
      .single();

    if (error || !data) {
      return { data: null, error: "Spiritual journal entry not found." };
    }

    return { data: mapRowToEntry(data as Parameters<typeof mapRowToEntry>[0]), error: null };
  } catch {
    return { data: null, error: "Failed to load spiritual journal entry." };
  }
}

export async function createSpiritualJournalEntry(
  supabase: SupabaseClient,
  servantId: string,
  input: CreateSpiritualJournalInput,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "You must be logged in." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("church_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return { data: null, error: "Profile not found." };
    }

    const { data, error } = await supabase
      .from("spiritual_journal_entries")
      .insert({
        church_id: profile.church_id,
        servant_id: servantId,
        entry_date: input.entryDate,
        prayer_completed: input.prayerCompleted,
        bible_reading: input.bibleReading,
        liturgy_attendance: input.liturgyAttendance,
        confession: input.confession,
        spiritual_notes: input.spiritualNotes?.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data.id }, error: null };
  } catch {
    return { data: null, error: "Failed to create spiritual journal entry." };
  }
}

export async function updateSpiritualJournalEntry(
  supabase: SupabaseClient,
  entryId: string,
  servantId: string,
  input: UpdateSpiritualJournalInput,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("spiritual_journal_entries")
      .update({
        prayer_completed: input.prayerCompleted,
        bible_reading: input.bibleReading,
        liturgy_attendance: input.liturgyAttendance,
        confession: input.confession,
        spiritual_notes: input.spiritualNotes?.trim() || null,
      })
      .eq("id", entryId)
      .eq("servant_id", servantId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update spiritual journal entry." };
  }
}

export async function deleteSpiritualJournalEntry(
  supabase: SupabaseClient,
  entryId: string,
  servantId: string,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("spiritual_journal_entries")
      .delete()
      .eq("id", entryId)
      .eq("servant_id", servantId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to delete spiritual journal entry." };
  }
}