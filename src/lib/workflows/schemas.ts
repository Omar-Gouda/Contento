import { z } from "zod";

const optionalUuidSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.string().uuid().nullable());

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

const optionalDateTimeSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value).toISOString() : null));

export const teamSchema = z.object({
  teamId: optionalUuidSchema,
  name: z.string().trim().min(1, "Team name is required.").max(120, "Team name is too long."),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer.").default(""),
  teamLeadId: optionalUuidSchema,
});

export const teamMembersSchema = z.object({
  teamId: z.string().trim().uuid(),
  memberIds: z.array(z.string().trim().uuid()).default([]),
  redirectTo: z.string().trim().default("/admin/teams"),
});

export const teamArchiveSchema = z.object({
  teamId: z.string().trim().uuid(),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required.").max(160, "Task title is too long."),
  description: z.string().trim().max(2000, "Description must be 2000 characters or fewer.").default(""),
  assignedTo: optionalUuidSchema,
  teamId: optionalUuidSchema,
  dueDate: optionalDateSchema,
  priority: z.enum(["low", "normal", "high", "urgent"]),
  redirectTo: z.string().trim().default("/tasks"),
});

export const taskAssignmentSchema = z.object({
  taskId: z.string().trim().uuid(),
  assignedTo: optionalUuidSchema,
  teamId: optionalUuidSchema,
  redirectTo: z.string().trim().default("/tasks"),
});

export const taskStatusSchema = z.object({
  taskId: z.string().trim().uuid(),
  status: z.enum(["pending", "assigned", "in_progress", "under_review", "completed", "closed"]),
  redirectTo: z.string().trim().default("/tasks"),
});

export const taskCommentSchema = z.object({
  taskId: z.string().trim().uuid(),
  body: z.string().trim().min(1, "Comment is required.").max(1000, "Comment is too long."),
  redirectTo: z.string().trim().default("/tasks"),
});

export const ideaSchema = z.object({
  ideaId: optionalUuidSchema,
  title: z.string().trim().min(1, "Idea title is required.").max(160, "Idea title is too long."),
  description: z.string().trim().max(2000, "Description must be 2000 characters or fewer.").default(""),
  assignedTo: optionalUuidSchema,
  teamId: optionalUuidSchema,
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or fewer.").default(""),
  redirectTo: z.string().trim().default("/ideas"),
});

export const ideaStatusSchema = z.object({
  ideaId: z.string().trim().uuid(),
  status: z.enum(["draft", "submitted", "under_review", "approved", "rejected", "archived"]),
  redirectTo: z.string().trim().default("/ideas"),
});

export const ideaDeleteSchema = z.object({
  ideaId: z.string().trim().uuid(),
  redirectTo: z.string().trim().default("/ideas"),
});

export const contentSchema = z.object({
  title: z.string().trim().min(1, "Content title is required.").max(180, "Content title is too long."),
  description: z.string().trim().max(3000, "Description must be 3000 characters or fewer.").default(""),
  creatorId: optionalUuidSchema,
  taskId: optionalUuidSchema,
  ideaId: optionalUuidSchema,
  teamId: optionalUuidSchema,
  redirectTo: z.string().trim().default("/content"),
});

export const contentSubmitSchema = z.object({
  contentId: z.string().trim().uuid(),
  redirectTo: z.string().trim().default("/content"),
});

export const contentReviewSchema = z.object({
  contentId: z.string().trim().uuid(),
  decision: z.enum(["send_to_supervisor", "approved", "changes_requested", "rejected"]),
  feedback: z.string().trim().max(2000, "Feedback must be 2000 characters or fewer.").default(""),
  redirectTo: z.string().trim().default("/content/reviews"),
});

export const contentRatingSchema = z.object({
  contentId: z.string().trim().uuid(),
  ratingValue: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000, "Rating comment must be 1000 characters or fewer.").default(""),
  redirectTo: z.string().trim().default("/content/reviews"),
});

export const contentScheduleSchema = z.object({
  contentId: z.string().trim().uuid(),
  scheduledAt: optionalDateTimeSchema,
  redirectTo: z.string().trim().default("/content"),
});

export const reportSchema = z.object({
  reportType: z.enum(["daily", "weekly", "creator", "team", "company"]),
  title: z.string().trim().min(1, "Report title is required.").max(160, "Report title is too long."),
  body: z.string().trim().min(1, "Report body is required.").max(5000, "Report body is too long."),
  userId: optionalUuidSchema,
  teamId: optionalUuidSchema,
  dateRangeStart: optionalDateSchema,
  dateRangeEnd: optionalDateSchema,
});
