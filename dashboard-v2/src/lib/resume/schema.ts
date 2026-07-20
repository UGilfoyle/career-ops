import { z } from 'zod';
import type { ResumeContext } from './types';

const candidateSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required').max(120),
  email: z.string().trim().email('Valid email is required').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  linkedin: z.string().trim().max(200).optional().or(z.literal('')),
  github: z.string().trim().max(200).optional().or(z.literal('')),
  portfolio_url: z.string().trim().max(300).optional().or(z.literal('')),
});

const experienceEntrySchema = z.object({
  role: z.string().trim().max(160).optional().or(z.literal('')),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  period: z.string().trim().max(80).optional().or(z.literal('')),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  bullets: z
    .array(z.string().trim().max(500))
    .max(12)
    .optional()
    .default([]),
});

const educationEntrySchema = z.object({
  degree: z.string().trim().max(200).optional().or(z.literal('')),
  school: z.string().trim().max(200).optional().or(z.literal('')),
  period: z.string().trim().max(80).optional().or(z.literal('')),
  location: z.string().trim().max(120).optional().or(z.literal('')),
});

export const resumeContextSchema = z.object({
  candidate: candidateSchema,
  narrative: z
    .object({
      headline: z.string().trim().max(400).optional().or(z.literal('')),
      exit_story: z.string().trim().max(2000).optional().or(z.literal('')),
      superpowers: z.array(z.string().trim().max(80)).max(30).optional().default([]),
      proof_points: z
        .array(
          z.object({
            name: z.string().trim().max(120).optional(),
            hero_metric: z.string().trim().max(200).optional(),
          })
        )
        .max(12)
        .optional()
        .default([]),
    })
    .optional()
    .default({ superpowers: [], proof_points: [] }),
  experience: z.array(experienceEntrySchema).max(20).optional().default([]),
  education: z.array(educationEntrySchema).max(10).optional().default([]),
  studio: z
    .object({
      template_id: z.string().trim().max(64).optional(),
    })
    .optional(),
});

export type ResumeContextValidated = z.infer<typeof resumeContextSchema>;

/** Soft validation for live editing — returns issues without throwing. */
export function validateResumeDraft(ctx: ResumeContext): {
  ok: boolean;
  errors: string[];
} {
  const result = resumeContextSchema.safeParse({
    candidate: ctx.candidate || {},
    narrative: ctx.narrative || {},
    experience: ctx.experience || [],
    education: ctx.education || [],
    studio: ctx.studio,
  });
  if (result.success) return { ok: true, errors: [] };
  const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return { ok: false, errors };
}

/** Strict parse for export — throws ZodError. */
export function parseResumeForExport(ctx: ResumeContext): ResumeContextValidated {
  return resumeContextSchema.parse({
    candidate: ctx.candidate || {},
    narrative: ctx.narrative || {},
    experience: ctx.experience || [],
    education: ctx.education || [],
    studio: ctx.studio,
  });
}
