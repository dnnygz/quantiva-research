/** Zod validators for admin write operations (used by the API and the admin forms). */
import { z } from 'zod';
import {
  AGGREGATIONS,
  AGREEMENT,
  FACTORS,
  MODEL_FAMILIES,
  SPLITS,
  STATUSES,
} from './domain';

const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const slug = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and dashes');

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
});

export const metricInputSchema = z.object({
  metricName: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Use snake_case metric keys'),
  value: z.number().finite(),
  split: z.enum(SPLITS).nullable().default(null),
  aggregation: z.enum(AGGREGATIONS).nullable().default(null),
  unit: text(32).nullable().default(null),
  source: text(300).nullable().default(null),
});

export const metricCreateSchema = metricInputSchema.extend({
  experimentId: z.number().int().positive(),
});
export const metricUpdateSchema = metricInputSchema.partial();

export const experimentInputSchema = z.object({
  slug,
  researchLineId: z.number().int().positive(),
  protocolId: z.number().int().positive(),
  datasetId: z.number().int().positive().nullable(),
  title: requiredText(200),
  modelName: requiredText(80),
  modelFamily: z.enum(MODEL_FAMILIES),
  variant: text(80).nullable().default(null),
  setting: text(80).nullable().default(null),
  factor: z.enum(FACTORS),
  objective: text(1000).default(''),
  description: text(4000).default(''),
  configuration: z.record(z.string(), z.unknown()).nullable().default(null),
  fold: z.number().int().min(0).max(1000).nullable().default(null),
  seed: z.number().int().min(0).nullable().default(null),
  nSeeds: z.number().int().positive().nullable().default(null),
  nFolds: z.number().int().positive().nullable().default(null),
  observations: text(4000).nullable().default(null),
  limitations: text(4000).nullable().default(null),
  source: requiredText(300),
  status: z.enum(STATUSES).default('draft'),
  sortOrder: z.number().int().default(0),
  comparisonSetIds: z.array(z.number().int().positive()).max(50).default([]),
  /** Optional metric rows created together with the experiment. */
  metrics: z.array(metricInputSchema).max(100).default([]),
});
export const experimentUpdateSchema = experimentInputSchema
  .omit({ metrics: true })
  .partial();

export const trainingHistorySchema = z.object({
  points: z
    .array(
      z.object({
        epoch: z.number().int().min(0).max(100000),
        trainLoss: z.number().finite().nullable(),
        valLoss: z.number().finite().nullable(),
      }),
    )
    .max(5000),
});

export const questionInputSchema = z.object({
  slug,
  question: requiredText(300),
  context: text(2000).default(''),
  agreement: z.enum(AGREEMENT),
  openQuestions: text(2000).default(''),
  status: z.enum(STATUSES).default('draft'),
  sortOrder: z.number().int().default(0),
});
export const questionUpdateSchema = questionInputSchema.partial();

export const findingInputSchema = z.object({
  questionId: z.number().int().positive(),
  researchLineId: z.number().int().positive().nullable(),
  observation: requiredText(3000),
  interpretation: text(3000).default(''),
  limitations: text(3000).default(''),
  status: z.enum(STATUSES).default('draft'),
  sortOrder: z.number().int().default(0),
  experimentIds: z.array(z.number().int().positive()).max(100).default([]),
});
export const findingUpdateSchema = findingInputSchema.partial();

export const figureMetaSchema = z.object({
  title: requiredText(200),
  description: text(2000).default(''),
  source: text(300).nullable().default(null),
  experimentId: z.number().int().positive().nullable().default(null),
  researchLineId: z.number().int().positive(),
});
export const figureUpdateSchema = figureMetaSchema.partial();

export type LoginInput = z.infer<typeof loginSchema>;
export type MetricInput = z.infer<typeof metricInputSchema>;
export type ExperimentInput = z.infer<typeof experimentInputSchema>;
export type ExperimentUpdate = z.infer<typeof experimentUpdateSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;
export type FindingInput = z.infer<typeof findingInputSchema>;
export type FigureMeta = z.infer<typeof figureMetaSchema>;
