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

export const clientProfileSchema = z.object({
  clientId: optionalUuidSchema,
  name: z.string().trim().min(1, "Client name is required.").max(160, "Client name is too long."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, "Slug is too long.")
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers, and dashes only.")
    .optional()
    .default(""),
  logoUrl: optionalUrlSchema,
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  accentColor: colorSchema,
  contactPerson: z.string().trim().max(120, "Contact name is too long.").default(""),
  contactEmail: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(z.string().email("Enter a valid contact email.").nullable()),
  contactPhone: z.string().trim().max(60, "Contact phone is too long.").default(""),
  briefDriveLink: optionalUrlSchema,
  notes: z.string().trim().max(3000, "Notes are too long.").default(""),
  requirements: z.string().trim().max(5000, "Brief details are too long.").default(""),
  assignedAccountManagerId: optionalUuidSchema,
  assignedUserIds: z.array(z.string().trim().uuid()).default([]),
  status: z.enum(["active", "paused", "archived"]),
});

export const archiveClientSchema = z.object({
  clientId: z.string().trim().uuid(),
});
