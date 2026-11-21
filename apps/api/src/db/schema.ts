/**
 * PostgreSQL schema (Drizzle). Minimal relational model:
 *
 *  research_lines ─┬─ protocols ── experiments ── metrics
 *                  │                    │  └──── training_history (only real per-epoch data)
 *                  │                    └──────── figures (R2 storage_key)
 *                  └─ comparison_sets ── comparison_set_experiments
 *  research_questions ── findings ── finding_experiments
 *  admin_users ── sessions ;  login_attempts
 *
 * A metric row stores one published number with its split and aggregation level,
 * so a mean over 30 seeds is never confused with an individual run.
 */
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';

export const statusEnum = pgEnum('record_status', ['draft', 'published']);
export const splitEnum = pgEnum('metric_split', ['train', 'test', 'validation']);
export const aggregationEnum = pgEnum('metric_aggregation', [
  'single_run',
  'mean_over_seeds',
  'mean_over_folds_and_seeds',
  'fold_mean_over_seeds',
  'std_between_fold_means',
  'range_min',
  'range_max',
]);
export const modelFamilyEnum = pgEnum('model_family', ['quantum', 'classical', 'hybrid']);
export const agreementEnum = pgEnum('agreement', ['converging', 'mixed', 'open']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** NUMERIC columns are returned as JS numbers (never strings). */
const num = (name: string) => numeric(name, { mode: 'number' });

export const researchLines = pgTable('research_lines', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  description: text('description').notNull().default(''),
  manuscriptTitle: text('manuscript_title').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamps.createdAt,
});

export const datasets = pgTable('datasets', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  description: text('description').notNull().default(''),
  samples: text('samples'),
  features: text('features'),
});

export const protocols = pgTable('protocols', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  researchLineId: integer('research_line_id')
    .notNull()
    .references(() => researchLines.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  evaluation: text('evaluation').notNull(),
  description: text('description').notNull().default(''),
  limitations: text('limitations').notNull().default(''),
});

export const experiments = pgTable(
  'experiments',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    researchLineId: integer('research_line_id')
      .notNull()
      .references(() => researchLines.id, { onDelete: 'restrict' }),
    protocolId: integer('protocol_id')
      .notNull()
      .references(() => protocols.id, { onDelete: 'restrict' }),
    datasetId: integer('dataset_id').references(() => datasets.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    modelName: text('model_name').notNull(),
    modelFamily: modelFamilyEnum('model_family').notNull(),
    variant: text('variant'),
    setting: text('setting'),
    factor: text('factor').notNull(),
    objective: text('objective').notNull().default(''),
    description: text('description').notNull().default(''),
    configuration: jsonb('configuration').$type<Record<string, unknown>>(),
    fold: integer('fold'),
    seed: integer('seed'),
    nSeeds: integer('n_seeds'),
    nFolds: integer('n_folds'),
    observations: text('observations'),
    limitations: text('limitations'),
    source: text('source').notNull(),
    status: statusEnum('status').notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('experiments_line_idx').on(t.researchLineId),
    index('experiments_status_idx').on(t.status),
  ],
);

export const metrics = pgTable(
  'metrics',
  {
    id: serial('id').primaryKey(),
    experimentId: integer('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    metricName: text('metric_name').notNull(),
    value: num('metric_value').notNull(),
    split: splitEnum('split'),
    aggregation: aggregationEnum('aggregation_type'),
    unit: text('unit'),
    source: text('source'),
  },
  (t) => [index('metrics_experiment_idx').on(t.experimentId)],
);

export const trainingHistory = pgTable(
  'training_history',
  {
    experimentId: integer('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    epoch: integer('epoch').notNull(),
    trainLoss: num('train_loss'),
    valLoss: num('val_loss'),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.epoch] })],
);

export const comparisonSets = pgTable('comparison_sets', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  researchLineId: integer('research_line_id')
    .notNull()
    .references(() => researchLines.id, { onDelete: 'restrict' }),
  protocolId: integer('protocol_id')
    .notNull()
    .references(() => protocols.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  factor: text('factor').notNull(),
  rowLabel: text('row_label').notNull().default('Dataset'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const comparisonSetExperiments = pgTable(
  'comparison_set_experiments',
  {
    setId: integer('set_id')
      .notNull()
      .references(() => comparisonSets.id, { onDelete: 'cascade' }),
    experimentId: integer('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.setId, t.experimentId] })],
);

export const researchQuestions = pgTable('research_questions', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  question: text('question').notNull(),
  context: text('context').notNull().default(''),
  agreement: agreementEnum('agreement').notNull().default('open'),
  openQuestions: text('open_questions').notNull().default(''),
  status: statusEnum('status').notNull().default('draft'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const findings = pgTable('findings', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id')
    .notNull()
    .references(() => researchQuestions.id, { onDelete: 'cascade' }),
  researchLineId: integer('research_line_id').references(() => researchLines.id, {
    onDelete: 'set null',
  }),
  observation: text('observation').notNull(),
  interpretation: text('interpretation').notNull().default(''),
  limitations: text('limitations').notNull().default(''),
  status: statusEnum('status').notNull().default('draft'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const findingExperiments = pgTable(
  'finding_experiments',
  {
    findingId: integer('finding_id')
      .notNull()
      .references(() => findings.id, { onDelete: 'cascade' }),
    experimentId: integer('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.findingId, t.experimentId] })],
);

export const figures = pgTable('figures', {
  id: serial('id').primaryKey(),
  researchLineId: integer('research_line_id')
    .notNull()
    .references(() => researchLines.id, { onDelete: 'restrict' }),
  experimentId: integer('experiment_id').references(() => experiments.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  source: text('source'),
  storageKey: text('storage_key').notNull().unique(),
  contentType: text('content_type').notNull(),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamps.createdAt,
});

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamps.createdAt,
});

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the random session token; the raw token only lives in the cookie. */
    id: text('id').primaryKey(),
    adminUserId: integer('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('sessions_expires_idx').on(t.expiresAt)],
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    ip: text('ip').notNull(),
    email: text('email').notNull(),
    success: boolean('success').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('login_attempts_ip_idx').on(t.ip, t.createdAt),
    index('login_attempts_email_idx').on(t.email, t.createdAt),
  ],
);
