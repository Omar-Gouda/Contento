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
  clientId: optionalUuidSchema,
  title: z.string().trim().min(1, "Task title is required.").max(160, "Task title is too long."),
  description: z.string().trim().max(2000, "Description must be 2000 characters or fewer.").default(""),
  assignedTo: optionalUuidSchema,
  teamId: optionalUuidSchema,
  dueDate: optionalDateSchema,
  priority: z.enum(["low", "normal", "high", "urgent"]),
  finalDriveLink: z.string().trim().max(500, "Final Drive link is too long.").default(""),
  redirectTo: z.string().trim().default("/tasks"),
});

export const taskAssignmentSchema = z.object({
  taskId: z.string().trim().uuid(),
  clientId: optionalUuidSchema,
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

export const taskFinalOutputSchema = z.object({
  taskId: z.string().trim().uuid(),
  finalDriveLink: z.string().trim().url("Enter a valid final Drive URL.").max(500, "Final Drive link is too long."),
  redirectTo: z.string().trim().default("/tasks"),
});

export const ideaSchema = z.object({
  ideaId: optionalUuidSchema,
  clientId: optionalUuidSchema,
  ideaType: z.enum(["post", "reel", "story"]).default("post"),
  title: z.string().trim().min(1, "Idea title is required.").max(160, "Idea title is too long."),
  description: z.string().trim().max(2000, "Description must be 2000 characters or fewer.").default(""),
  assignedTo: optionalUuidSchema,
  teamId: optionalUuidSchema,
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or fewer.").default(""),
  platforms: z.array(z.string().trim().max(40)).default([]),
  headline: z.string().trim().max(180, "Headline is too long.").default(""),
  subtext: z.string().trim().max(500, "Subtext is too long.").default(""),
  visual: z.string().trim().max(1000, "Visual direction is too long.").default(""),
  cta: z.string().trim().max(160, "CTA is too long.").default(""),
  script: z.string().trim().max(3000, "Script is too long.").default(""),
  urgency: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  publishingAt: optionalDateTimeSchema,
  finalDriveLink: z.string().trim().max(500, "Final Drive link is too long.").default(""),
  redirectTo: z.string().trim().default("/ideas"),
});

export const ideaStatusSchema = z.object({
  ideaId: z.string().trim().uuid(),
  status: z.enum(["draft", "submitted", "under_review", "approved", "rejected", "archived"]),
  redirectTo: z.string().trim().default("/ideas"),
});

export const ideaReviewSchema = z.object({
  ideaId: z.string().trim().uuid(),
  decision: z.enum(["under_review", "approved", "rejected", "revision_requested"]),
  feedback: z.string().trim().max(2000, "Feedback must be 2000 characters or fewer.").default(""),
  redirectTo: z.string().trim().default("/reviews/ideas"),
});

export const ideaDeleteSchema = z.object({
  ideaId: z.string().trim().uuid(),
  redirectTo: z.string().trim().default("/ideas"),
});

export const contentSchema = z.object({
  clientId: optionalUuidSchema,
  title: z.string().trim().min(1, "Content title is required.").max(180, "Content title is too long."),
  description: z.string().trim().max(3000, "Description must be 3000 characters or fewer.").default(""),
  templateId: optionalUuidSchema,
  creatorId: optionalUuidSchema,
  taskId: optionalUuidSchema,
  ideaId: optionalUuidSchema,
  teamId: optionalUuidSchema,
  finalDriveLink: z.string().trim().max(500, "Final Drive link is too long.").default(""),
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
  qualityScore: z.coerce.number().int().min(1).max(5).optional().nullable(),
  creativityScore: z.coerce.number().int().min(1).max(5).optional().nullable(),
  accuracyScore: z.coerce.number().int().min(1).max(5).optional().nullable(),
  overallRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  scoreComment: z.string().trim().max(1000, "Score comment must be 1000 characters or fewer.").default(""),
  redirectTo: z.string().trim().default("/reviews/content"),
});

export const contentRatingSchema = z.object({
  contentId: z.string().trim().uuid(),
  ratingValue: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000, "Rating comment must be 1000 characters or fewer.").default(""),
  redirectTo: z.string().trim().default("/reviews/content"),
});

export const contentScheduleSchema = z.object({
  contentId: z.string().trim().uuid(),
  scheduledAt: optionalDateTimeSchema,
  redirectTo: z.string().trim().default("/content"),
});

export const contentFinalOutputSchema = z.object({
  contentId: z.string().trim().uuid(),
  finalDriveLink: z.string().trim().url("Enter a valid final Drive URL.").max(500, "Final Drive link is too long."),
  redirectTo: z.string().trim().default("/content"),
});

export const reportSchema = z.object({
  clientId: optionalUuidSchema,
  reportType: z.enum(["daily", "weekly", "creator", "team", "company"]),
  title: z.string().trim().min(1, "Report title is required.").max(160, "Report title is too long."),
  body: z.string().trim().min(1, "Report body is required.").max(5000, "Report body is too long."),
  userId: optionalUuidSchema,
  teamId: optionalUuidSchema,
  dateRangeStart: optionalDateSchema,
  dateRangeEnd: optionalDateSchema,
});

export const generatedReportSchema = z.object({
  clientId: optionalUuidSchema,
  reportType: z.enum(["daily", "weekly"]),
  userId: optionalUuidSchema,
  teamId: optionalUuidSchema,
  note: z.string().trim().max(2000, "Note is too long.").default(""),
  postsPublished: z.string().trim().max(40).default(""),
  storiesPublished: z.string().trim().max(40).default(""),
  reelsPublished: z.string().trim().max(40).default(""),
  reachGrowth: z.string().trim().max(40).default(""),
  engagementRate: z.string().trim().max(40).default(""),
  followerGrowth: z.string().trim().max(40).default(""),
  keyAchievements: z.string().trim().max(2000).default(""),
  mainChallenges: z.string().trim().max(2000).default(""),
  nextMonthFocus: z.string().trim().max(2000).default(""),
  totalAdSpend: z.string().trim().max(80).default(""),
  reach: z.string().trim().max(80).default(""),
  impressions: z.string().trim().max(80).default(""),
  clicks: z.string().trim().max(80).default(""),
  ctr: z.string().trim().max(80).default(""),
  cpc: z.string().trim().max(80).default(""),
  cpm: z.string().trim().max(80).default(""),
  leadsGenerated: z.string().trim().max(80).default(""),
  conversions: z.string().trim().max(80).default(""),
  roas: z.string().trim().max(80).default(""),
  customSection: z.string().trim().max(3000).default(""),
});

export const reportSendToClientSchema = z.object({
  reportId: z.string().trim().uuid(),
  redirectTo: z.string().trim().default("/reports"),
});

export const timeOffRequestSchema = z
  .object({
    requestType: z.enum(["day_off", "sick_leave"]),
    startDate: z.string().trim().min(1, "Start date is required."),
    endDate: z.string().trim().min(1, "End date is required."),
    reason: z.string().trim().min(1, "Reason is required.").max(1000, "Reason is too long."),
    redirectTo: z.string().trim().default("/calendar"),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be on or after start date.",
    path: ["endDate"],
  });

export const timeOffReviewSchema = z.object({
  requestId: z.string().trim().uuid(),
  decision: z.enum(["approved", "rejected"]),
  redirectTo: z.string().trim().default("/calendar"),
});

export const contentTemplateSchema = z.object({
  templateId: optionalUuidSchema,
  title: z.string().trim().min(1, "Template title is required.").max(160, "Template title is too long."),
  description: z.string().trim().max(1000, "Template description is too long.").default(""),
  body: z.string().trim().max(5000, "Template body is too long.").default(""),
  category: z.string().trim().max(80, "Template category is too long.").default(""),
  redirectTo: z.string().trim().default("/content"),
});

export const contentTemplateArchiveSchema = z.object({
  templateId: z.string().trim().uuid(),
  redirectTo: z.string().trim().default("/content"),
});
