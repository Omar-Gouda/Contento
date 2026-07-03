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

const optionalLogoValueSchema = z
  .string()
  .trim()
  .max(500, "Logo value is too long.")
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(
    z
      .string()
      .refine((value) => {
        if (/^https?:\/\//i.test(value)) {
          return z.string().url().safeParse(value).success;
        }

        return /^[a-zA-Z0-9/_./-]+$/.test(value);
      }, "Logo must be a valid URL or stored workspace logo path.")
      .nullable()
  );

const colorSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #2563eb.").nullable());

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").nullable());

export const clientProfileSchema = z.object({
  clientId: optionalUuidSchema,
  name: z.string().trim().min(1, "Client name is required.").max(160, "Client name is too long."),
  slug: z
    .string()
    .trim()
    .max(160, "Slug is too long.")
    .optional()
    .default(""),
  logoUrl: optionalLogoValueSchema,
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
  contractStartDate: optionalDateSchema,
  contractEndDate: optionalDateSchema,
  disabledReason: z.string().trim().max(500, "Disabled reason is too long.").default(""),
  status: z.enum(["active", "disabled", "expired", "archived"]),
}).refine((value) => {
  if (!value.contractStartDate || !value.contractEndDate) {
    return true;
  }

  return value.contractEndDate >= value.contractStartDate;
}, {
  message: "Contract end date must be on or after the start date.",
  path: ["contractEndDate"],
});

export const archiveClientSchema = z.object({
  clientId: z.string().trim().uuid(),
});

export const clientAssignmentSchema = z.object({
  clientId: z.string().trim().uuid("Choose a valid client."),
  userId: z.string().trim().uuid("Choose a valid user."),
  assignmentRole: z
    .enum(["account_manager", "content_creator", "graphic_designer", "video_editor", "client_contact", "member"])
    .optional(),
  redirectTo: z.string().trim().optional().default("/clients"),
});
