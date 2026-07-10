import { z } from "zod";

export const organizationRequestSchema = z.object({
  organizationName: z.string().trim().min(2, "Enter the organization name.").max(120),
  agencyName: z.string().trim().min(2, "Enter the agency name.").max(120),
  ownerFullName: z.string().trim().min(2, "Enter the owner full name.").max(160),
  businessEmail: z.string().trim().email("Enter a valid business email address.").max(180),
  phone: z.string().trim().min(5, "Enter a phone number.").max(40),
  country: z.string().trim().min(2, "Enter the country.").max(80),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  agencySize: z.string().trim().min(2, "Choose an agency size.").max(80),
  numberOfEmployees: z.coerce.number().int().min(1, "Enter at least 1 employee.").max(100000),
  expectedUsers: z.coerce.number().int().min(1, "Enter at least 1 expected user.").max(100000),
  expectedClients: z.coerce.number().int().min(0, "Expected clients cannot be negative.").max(100000),
  website: z.string().trim().max(180).optional(),
  industry: z.string().trim().min(2, "Enter the industry.").max(120),
  preferredContract: z.enum(["monthly", "yearly"], {
    message: "Choose monthly or yearly contract preference.",
  }),
  needsEnterprisePricing: z.coerce.boolean(),
  additionalNotes: z.string().trim().max(2000).optional(),
});

export type OrganizationRequestInput = z.infer<typeof organizationRequestSchema>;

export const organizationRequestReviewSchema = z.object({
  requestId: z.string().uuid("Organization request could not be resolved."),
});

export const organizationRequestRejectSchema = organizationRequestReviewSchema.extend({
  rejectionReason: z.string().trim().min(3, "Enter a rejection reason.").max(1000),
});
