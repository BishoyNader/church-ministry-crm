import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  remember: z.boolean().optional(),
});

export const signupSchema = z
  .object({
    churchId: z
      .string()
      .uuid({ message: "Please select your church" })
      .refine((value) => value !== "__new_church__", {
        message: "Please select your church",
      }),
    fullNameAr: z.string().min(2, { message: "الاسم العربي مطلوب" }),
    fullNameEn: z.string().optional(),
    email: z.string().email({ message: "Invalid email address" }),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{6,}$/, { message: "Please provide a valid phone number" })
      .optional()
      .or(z.literal("")),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string().min(8, { message: "Password confirmation is required" }),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string().min(8, { message: "Password confirmation is required" }),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });
