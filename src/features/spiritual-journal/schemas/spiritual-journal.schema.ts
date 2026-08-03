import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createSpiritualJournalSchema = z.object({
  entryDate: z.string().regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" }),
  prayerCompleted: z.boolean(),
  bibleReading: z.boolean(),
  liturgyAttendance: z.boolean(),
  confession: z.boolean(),
  spiritualNotes: z.string().max(2000, { message: "Notes must be 2000 characters or fewer" }).optional().or(z.literal("")),
});

export const updateSpiritualJournalSchema = z.object({
  prayerCompleted: z.boolean(),
  bibleReading: z.boolean(),
  liturgyAttendance: z.boolean(),
  confession: z.boolean(),
  spiritualNotes: z.string().max(2000, { message: "Notes must be 2000 characters or fewer" }).optional().or(z.literal("")),
});

export const spiritualJournalListParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  fromDate: z.string().regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" }).optional(),
  toDate: z.string().regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" }).optional(),
});

export const uuidParamSchema = z.string().uuid({ message: "Invalid ID format" });

export type CreateSpiritualJournalFormValues = z.infer<typeof createSpiritualJournalSchema>;
export type UpdateSpiritualJournalFormValues = z.infer<typeof updateSpiritualJournalSchema>;
export type SpiritualJournalListParamsFormValues = z.infer<typeof spiritualJournalListParamsSchema>;