import { z } from "zod";
import { normalizeBackupCode } from "@/src/backup/code";

const email = z.string().trim().min(1, "Email is required").email("Enter a valid email");
const password = z.string().min(6, "Use at least 6 characters");
const code = z
  .string()
  .trim()
  .regex(/^\d{6,10}$/, "Enter the code from your email");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({ email, password, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const codeSchema = z.object({ code });
export type CodeValues = z.infer<typeof codeSchema>;

export const forgotEmailSchema = z.object({ email });
export type ForgotEmailValues = z.infer<typeof forgotEmailSchema>;

export const resetSchema = z
  .object({ code, password, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });
export type ResetValues = z.infer<typeof resetSchema>;

export const restoreSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter your backup code")
    .refine((value) => normalizeBackupCode(value) !== null, "That code isn't valid"),
});
export type RestoreValues = z.infer<typeof restoreSchema>;
