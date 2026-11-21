/**
 * Domain vocabulary shared by the API, the seed builder and the web app.
 *
 * Metric keys describe *what* was measured. The split (train / test / validation)
 * and the aggregation level (single run, mean over seeds, fold mean, ...) are
 * stored separately on each metric row, so a published mean is never confused
 * with an individual observation.
 */

export type MetricDirection = 'higher' | 'lower' | 'diverging' | 'neutral';

export interface MetricDefinition {
  key: string;
  label: string;
  short: string;
  direction: MetricDirection;
  decimals: number;
  unit?: string;
  description: string;
}

export const METRIC_DEFINITIONS = {
  roc_auc: {
    key: 'roc_auc',
    label: 'ROC-AUC',
    short: 'AUC',
    direction: 'higher',
    decimals: 3,
    description:
      'Probability that a random positive sample receives a higher score than a random negative one.',
  },
  gen_gap: {
    key: 'gen_gap',
    label: 'Generalization gap',
    short: 'Gap',
    direction: 'lower',
    decimals: 3,
    description:
      'Training AUC minus held-out AUC (test split in Line A, validation folds in Line B). Positive values mean the model ranks new samples worse than its training samples.',
  },
  brier: {
    key: 'brier',
    label: 'Brier score',
    short: 'Brier',
    direction: 'lower',
    decimals: 3,
    description: 'Mean squared difference between predicted probabilities and labels.',
  },
  log_loss: {
    key: 'log_loss',
    label: 'Log loss',
    short: 'Log loss',
    direction: 'lower',
    decimals: 4,
    unit: 'nats',
    description: 'Binary cross-entropy of the predicted probabilities, in nats.',
  },
  balanced_accuracy: {
    key: 'balanced_accuracy',
    label: 'Balanced accuracy',
    short: 'Bal. acc.',
    direction: 'higher',
    decimals: 4,
    description: 'Mean of per-class recall at the reported decision threshold.',
  },
  recall_minority: {
    key: 'recall_minority',
    label: 'ER− recall',
    short: 'ER− recall',
    direction: 'higher',
    decimals: 4,
    description: 'Recall (sensitivity) on the ER-negative class.',
  },
  auc_difference: {
    key: 'auc_difference',
    label: 'AUC difference',
    short: 'ΔAUC',
    direction: 'diverging',
    decimals: 3,
    description:
      'Paired difference of AUC values between two pipelines evaluated on the same folds and seeds. The sign convention is stated on each experiment.',
  },
  param_count_nominal: {
    key: 'param_count_nominal',
    label: 'Nominal parameters',
    short: 'Params',
    direction: 'neutral',
    decimals: 0,
    description: 'Number of trainable parameters as declared by the architecture.',
  },
  param_count_effective: {
    key: 'param_count_effective',
    label: 'Effective parameters',
    short: 'Eff. params',
    direction: 'neutral',
    decimals: 0,
    description: 'Parameters that are functionally relevant (rank of the Jacobian for circuits).',
  },
  geometry_ratio: {
    key: 'geometry_ratio',
    label: 'Quantum-geometry ratio |J|/D_tr',
    short: '|J|/D_tr',
    direction: 'neutral',
    decimals: 4,
    description:
      'Class-mean contrast under the observable divided by the trace distance between class-conditional state mixtures. Not a measure of patient-level predictive information.',
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricKey = keyof typeof METRIC_DEFINITIONS;
export const METRIC_KEYS = Object.keys(METRIC_DEFINITIONS) as MetricKey[];

export function metricDefinition(key: string): MetricDefinition {
  return (
    (METRIC_DEFINITIONS as Record<string, MetricDefinition>)[key] ?? {
      key,
      label: key.replace(/_/g, ' '),
      short: key,
      direction: 'neutral',
      decimals: 3,
      description: 'Custom metric registered by an administrator.',
    }
  );
}

export const SPLITS = ['train', 'test', 'validation'] as const;
export type Split = (typeof SPLITS)[number];
export const SPLIT_LABELS: Record<Split, string> = {
  train: 'Training',
  test: 'Test',
  validation: 'Validation',
};

/** How a stored number relates to the underlying runs. */
export const AGGREGATIONS = [
  'single_run',
  'mean_over_seeds',
  'mean_over_folds_and_seeds',
  'fold_mean_over_seeds',
  'std_between_fold_means',
  'range_min',
  'range_max',
] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];
export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  single_run: 'Single run',
  mean_over_seeds: 'Mean over seeds',
  mean_over_folds_and_seeds: 'Mean over folds and seeds',
  fold_mean_over_seeds: 'Fold mean over seeds',
  std_between_fold_means: 'SD between fold means',
  range_min: 'Lower end of reported range',
  range_max: 'Upper end of reported range',
};

export const FACTORS = [
  'baseline',
  'representation',
  'encoding',
  'capacity_readout',
  'training_size',
  'optimization',
  'teacher',
  'memorization',
  'readout',
  'geometry',
] as const;
export type Factor = (typeof FACTORS)[number];
export const FACTOR_LABELS: Record<Factor, string> = {
  baseline: 'Baseline comparison',
  representation: 'Input representation',
  encoding: 'Data encoding',
  capacity_readout: 'Capacity & readout',
  training_size: 'Training-set size',
  optimization: 'Optimization budget',
  teacher: 'Classical teacher',
  memorization: 'Label randomization',
  readout: 'Readout comparison',
  geometry: 'Representation geometry',
};

export const MODEL_FAMILIES = ['quantum', 'classical', 'hybrid'] as const;
export type ModelFamily = (typeof MODEL_FAMILIES)[number];

export const STATUSES = ['draft', 'published'] as const;
export type Status = (typeof STATUSES)[number];

export const AGREEMENT = ['converging', 'mixed', 'open'] as const;
export type Agreement = (typeof AGREEMENT)[number];
export const AGREEMENT_LABELS: Record<Agreement, string> = {
  converging: 'Lines converge',
  mixed: 'Mixed evidence',
  open: 'Open question',
};

/** Canonical model order used for columns and color assignment. */
export const MODEL_ORDER = ['VQC', 'LR', 'SVM', 'RF', 'XGBoost', 'MLP'] as const;

export const FIGURE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const FIGURE_MAX_BYTES = 5 * 1024 * 1024;
