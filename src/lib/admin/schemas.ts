import { z } from "zod";

const optionalUuidSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.string().uuid().nullable());

const optionalUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.string().url("Enter a valid URL.").nullable());

const colorSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #2563eb.").nullable());

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  roleId: z.string().trim().uuid("Choose a valid role."),
  teamId: optionalUuidSchema,
  message: z.string().trim().max(500, "Message must be 500 characters or fewer.").optional().default(""),
});

export const createCompanyUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  firstName: z.string().trim().min(1, "First name is required.").max(80, "First name is too long."),
  lastName: z.string().trim().min(1, "Last name is required.").max(80, "Last name is too long."),
  roleId: z.string().trim().uuid("Choose a valid role."),
  teamId: optionalUuidSchema,
  clientIds: z.array(z.string().trim().uuid()).default([]),
  clientName: z.string().trim().max(160, "Client name is too long.").default(""),
  clientLogoUrl: optionalUrlSchema,
  clientPrimaryColor: colorSchema,
  clientSecondaryColor: colorSchema,
  clientContactPhone: z.string().trim().max(60, "Contact phone is too long.").default(""),
  clientBriefDriveLink: optionalUrlSchema,
  clientNotes: z.string().trim().max(3000, "Client notes are too long.").default(""),
  assignedAccountManagerId: optionalUuidSchema,
  status: z.enum(["active", "suspended", "disabled"]),
  temporaryPassword: z
    .string()
    .min(8, "Temporary password must be at least 8 characters.")
    .regex(/[A-Z]/, "Temporary password must include an uppercase letter.")
    .regex(/[a-z]/, "Temporary password must include a lowercase letter.")
    .regex(/[0-9]/, "Temporary password must include a number."),
  confirmTemporaryPassword: z.string(),
}).refine((value) => value.temporaryPassword === value.confirmTemporaryPassword, {
  message: "Temporary passwords do not match.",
  path: ["confirmTemporaryPassword"],
});

export const updateUserStatusSchema = z.object({
  userId: z.string().trim().uuid(),
  status: z.enum(["active", "suspended", "disabled"]),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().trim().uuid(),
  roleId: z.string().trim().uuid(),
});

export const updateUserTeamSchema = z.object({
  userId: z.string().trim().uuid(),
  teamId: optionalUuidSchema,
});

export const terminateUserSchema = z.object({
  userId: z.string().trim().uuid(),
  mode: z.enum(["keep_content", "remove_content"]),
  confirmation: z.string().trim().default(""),
}).refine((value) => value.mode !== "remove_content" || value.confirmation === "DELETE", {
  message: "Type DELETE to permanently remove owned work.",
  path: ["confirmation"],
});

export const updateInvitationStatusSchema = z.object({
  invitationId: z.string().trim().uuid(),
  status: z.enum(["cancelled", "expired"]),
});
