import { z } from "zod";

export const churchRequestSchema = z.object({
  churchNameAr: z.string().trim().min(2, { message: "Church name (Arabic) is required." }),
  catechistName: z.string().trim().min(2, { message: "Catechist name is required." }),
  applicantName: z.string().trim().min(2, { message: "Applicant name is required." }),
  email: z.string().trim().email({ message: "Invalid email address." }),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{6,}$/, { message: "Please provide a valid phone number" })
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(1000, { message: "Notes must be 1000 characters or fewer." }).optional(),
});

export type ChurchRequestFormValues = z.infer<typeof churchRequestSchema>;
