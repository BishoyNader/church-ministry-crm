import type { Database } from "@/types/database.types";

export type SpiritualJournalRow = Database["public"]["Tables"]["spiritual_journal_entries"]["Row"];

export type SpiritualJournalEntry = {
  id: string;
  churchId: string;
  servantId: string;
  entryDate: string;
  prayerCompleted: boolean;
  bibleReading: boolean;
  liturgyAttendance: boolean;
  confession: boolean;
  spiritualNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SpiritualJournalListParams = {
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
};

export type SpiritualJournalListResult = {
  data: SpiritualJournalEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateSpiritualJournalInput = {
  entryDate: string;
  prayerCompleted: boolean;
  bibleReading: boolean;
  liturgyAttendance: boolean;
  confession: boolean;
  spiritualNotes?: string | null;
};

export type UpdateSpiritualJournalInput = {
  prayerCompleted: boolean;
  bibleReading: boolean;
  liturgyAttendance: boolean;
  confession: boolean;
  spiritualNotes?: string | null;
};