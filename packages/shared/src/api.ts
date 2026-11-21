/**
 * Public API contract (JSON shapes returned by the Hono API).
 * Numeric metric values are always numbers in JSON, never strings.
 */
import type {
  Agreement,
  Aggregation,
  Factor,
  ModelFamily,
  Split,
  Status,
} from './domain';

export interface ResearchLine {
  id: number;
  slug: string;
  code: string; // "A", "B", ...
  name: string;
  shortName: string;
  description: string;
  manuscriptTitle: string;
  sortOrder: number;
}

export interface Dataset {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  samples: string | null;
  features: string | null;
}

export interface Protocol {
  id: number;
  slug: string;
  researchLineId: number;
  name: string;
  evaluation: string; // e.g. "30 stratified 70/30 re-splits, test split"
  description: string;
  limitations: string;
}

export interface ComparisonSet {
  id: number;
  slug: string;
  researchLineId: number;
  protocolId: number;
  name: string;
  description: string;
  factor: Factor;
  /** Label for the row dimension in heatmaps ("Dataset", "Task", "Fold"). */
  rowLabel: string;
  sortOrder: number;
  experimentIds: number[];
}

export interface Metric {
  id: number;
  experimentId: number;
  metricName: string;
  value: number;
  split: Split | null;
  aggregation: Aggregation | null;
  unit: string | null;
  source: string | null;
}

export interface TrainingPoint {
  epoch: number;
  trainLoss: number | null;
  valLoss: number | null;
}

export interface Experiment {
  id: number;
  slug: string;
  researchLineId: number;
  protocolId: number;
  datasetId: number | null;
  title: string;
  modelName: string;
  modelFamily: ModelFamily;
  variant: string | null;
  /** Row key for heatmaps when the dataset alone is not enough (e.g. task, fold). */
  setting: string | null;
  factor: Factor;
  objective: string;
  description: string;
  configuration: Record<string, unknown> | null;
  fold: number | null;
  seed: number | null;
  nSeeds: number | null;
  nFolds: number | null;
  observations: string | null;
  limitations: string | null;
  source: string;
  status: Status;
  sortOrder: number;
  updatedAt: string;
  metrics: Metric[];
  hasTrainingHistory: boolean;
}

export interface Figure {
  id: number;
  experimentId: number | null;
  researchLineId: number;
  title: string;
  description: string;
  source: string | null;
  url: string;
  width: number | null;
  height: number | null;
}

export interface ExperimentDetail extends Experiment {
  figures: Figure[];
  trainingHistory: TrainingPoint[];
  findingIds: number[];
}

export interface Finding {
  id: number;
  questionId: number;
  researchLineId: number | null;
  observation: string;
  interpretation: string;
  limitations: string;
  status: Status;
  sortOrder: number;
  experimentIds: number[];
}

export interface ResearchQuestion {
  id: number;
  slug: string;
  question: string;
  context: string;
  agreement: Agreement;
  openQuestions: string;
  status: Status;
  sortOrder: number;
  findings: Finding[];
}

export interface Catalog {
  researchLines: ResearchLine[];
  datasets: Dataset[];
  protocols: Protocol[];
  comparisonSets: ComparisonSet[];
}

export interface AdminUser {
  id: number;
  email: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
