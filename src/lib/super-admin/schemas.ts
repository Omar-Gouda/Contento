import { z } from "zod";

export const createOrganizationSchema = z.object({
  companyName: z.string().trim().min(2, "Organization name must be at least 2 characters.").max(120),
  companySlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Organization slug must be at least 3 characters.")
    .max(64, "Organization slug must be 64 characters or fewer.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens only."),
  adminEmail: z.string().trim().email("Enter a valid admin email address."),
  adminFirstName: z.string().trim().min(1, "Enter the admin first name.").max(80),
  adminLastName: z.string().trim().min(1, "Enter the admin last name.").max(80),
  adminPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
