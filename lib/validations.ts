import { z } from "zod";

export const usernameSchema = z
  .string()
  .check(
    z.minLength(3, "Username must be at least 3 characters long."),
    z.maxLength(30, "Username must be less than 30 characters long."),
    z.regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, hyphens and underscores."
    )
  );

export const firstNameSchema = z
  .string()
  .min(1, "First name is required.")
  .max(50, "First name must be less than 50 characters long.");

export const lastNameSchema = z
  .string()
  .min(1, "Last name is required.")
  .max(50, "Last name must be less than 50 characters long.");

export const emailSchema = z.email("Email must be valid.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password must be less than 72 characters long.");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const profileFieldSchemas = {
  username: usernameSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
} as const;

export const groupNameSchema = z
  .string()
  .min(1, "Group name is required.")
  .max(50, "Group name must be less than 50 characters.");

export const inviteCodeSchema = z
  .string()
  .min(1, "Invite code is required.")
  .max(50, "Invite code must be less than 50 characters.");

export const consecutiveDaysSchema = z.coerce
  .number()
  .int("Must be a whole number.")
  .min(1, "Must be at least 1 day.")
  .max(19, "Cannot exceed 19 days.");

const OLYMPIC_START = "2028-07-12";
const OLYMPIC_END = "2028-07-30";

export const dateRangeSchema = z
  .object({
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be before or equal to end date.",
    path: ["endDate"],
  })
  .refine((data) => data.startDate >= OLYMPIC_START, {
    message:
      "Start date must be within the Olympic period (Jul 12 - Jul 30, 2028).",
    path: ["startDate"],
  })
  .refine((data) => data.endDate <= OLYMPIC_END, {
    message:
      "End date must be within the Olympic period (Jul 12 - Jul 30, 2028).",
    path: ["endDate"],
  });
