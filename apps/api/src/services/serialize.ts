/**
 * Row → API contract mapping plus the few loaders shared by public and admin routes.
 * Data volume is small (~130 experiments), so we run a handful of selects and assemble in TS.
 */
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import type {
  Agreement,
  Aggregation,
  ComparisonSet,
  Experiment,
  ExperimentDetail,
  Factor,
  Figure,
  Finding,
  Metric,
  ResearchQuestion,
  Split,
} from '@qa/shared';
import type { Db } from '../db/client';
import {
  comparisonSetExperiments,
  comparisonSets,
  experiments,
  figures,
  findingExperiments,
  findings,
  metrics,
  researchQuestions,
  trainingHistory,
} from '../db/schema';
import { figureUrl } from './figures';

type ExperimentRow = typeof experiments.$inferSelect;
type MetricRow = typeof metrics.$inferSelect;
type FigureRow = typeof figures.$inferSelect;
type FindingRow = typeof findings.$inferSelect;
type QuestionRow = typeof researchQuestions.$inferSelect;
type SetRow = typeof comparisonSets.$inferSelect;

export function toMetric(m: MetricRow): Metric {
  return {
    id: m.id,
    experimentId: m.experimentId,
    metricName: m.metricName,
    value: Number(m.value),
    split: (m.split as Split | null) ?? null,
    aggregation: (m.aggregation as Aggregation | null) ?? null,
    unit: m.unit,
    source: m.source,
  };
}

export function toExperiment(e: ExperimentRow, ms: Metric[], hasTrainingHistory: boolean): Experiment {
  return {
    id: e.id,
    slug: e.slug,
    researchLineId: e.researchLineId,
    protocolId: e.protocolId,
    datasetId: e.datasetId,
    title: e.title,
    modelName: e.modelName,
    modelFamily: e.modelFamily,
    variant: e.variant,
    setting: e.setting,
    factor: e.factor as Factor,
    objective: e.objective,
    description: e.description,
    configuration: e.configuration ?? null,
    fold: e.fold,
    seed: e.seed,
    nSeeds: e.nSeeds,
    nFolds: e.nFolds,
    observations: e.observations,
    limitations: e.limitations,
    source: e.source,
    status: e.status,
    sortOrder: e.sortOrder,
    updatedAt: e.updatedAt.toISOString(),
    metrics: ms,
    hasTrainingHistory,
  };
}

export function toFigure(f: FigureRow): Figure {
  return {
    id: f.id,
    experimentId: f.experimentId,
    researchLineId: f.researchLineId,
    title: f.title,
    description: f.description,
    source: f.source,
    url: figureUrl(f.id),
    width: f.width,
    height: f.height,
  };
}

export function toFinding(f: FindingRow, experimentIds: number[]): Finding {
  return {
    id: f.id,
    questionId: f.questionId,
    researchLineId: f.researchLineId,
    observation: f.observation,
    interpretation: f.interpretation,
    limitations: f.limitations,
    status: f.status,
    sortOrder: f.sortOrder,
    experimentIds,
  };
}

export function toQuestion(q: QuestionRow, fs: Finding[]): ResearchQuestion {
  return {
    id: q.id,
    slug: q.slug,
    question: q.question,
    context: q.context,
    agreement: q.agreement as Agreement,
    openQuestions: q.openQuestions,
    status: q.status,
    sortOrder: q.sortOrder,
    findings: fs,
  };
}

export function toComparisonSet(s: SetRow, experimentIds: number[]): ComparisonSet {
  return {
    id: s.id,
    slug: s.slug,
    researchLineId: s.researchLineId,
    protocolId: s.protocolId,
    name: s.name,
    description: s.description,
    factor: s.factor as Factor,
    rowLabel: s.rowLabel,
    sortOrder: s.sortOrder,
    experimentIds,
  };
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Experiments (with metrics) matching `where`, ordered by sortOrder then id. */
export async function loadExperiments(db: Db, where?: SQL): Promise<Experiment[]> {
  const rows = await db
    .select()
    .from(experiments)
    .where(where)
    .orderBy(asc(experiments.sortOrder), asc(experiments.id));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [metricRows, historyRows] = await Promise.all([
    db
      .select()
      .from(metrics)
      .where(inArray(metrics.experimentId, ids))
      .orderBy(asc(metrics.id)),
    db
      .selectDistinct({ experimentId: trainingHistory.experimentId })
      .from(trainingHistory)
      .where(inArray(trainingHistory.experimentId, ids)),
  ]);
  const metricsBy = groupBy(metricRows.map(toMetric), (m) => m.experimentId);
  const withHistory = new Set(historyRows.map((h) => h.experimentId));
  return rows.map((r) => toExperiment(r, metricsBy.get(r.id) ?? [], withHistory.has(r.id)));
}

/**
 * Full detail for one experiment. With `publishedOnly`, the experiment, its linked findings
 * (and their questions) must be published, and figures follow the experiment's visibility.
 */
export async function loadExperimentDetail(
  db: Db,
  where: SQL,
  publishedOnly: boolean,
): Promise<ExperimentDetail | null> {
  const cond = publishedOnly ? and(where, eq(experiments.status, 'published')) : where;
  const [experiment] = await loadExperiments(db, cond);
  if (!experiment) return null;
  const findingCond = publishedOnly
    ? and(
        eq(findingExperiments.experimentId, experiment.id),
        eq(findings.status, 'published'),
        eq(researchQuestions.status, 'published'),
      )
    : eq(findingExperiments.experimentId, experiment.id);
  const [figureRows, history, findingRows] = await Promise.all([
    db
      .select()
      .from(figures)
      .where(eq(figures.experimentId, experiment.id))
      .orderBy(asc(figures.id)),
    db
      .select({
        epoch: trainingHistory.epoch,
        trainLoss: trainingHistory.trainLoss,
        valLoss: trainingHistory.valLoss,
      })
      .from(trainingHistory)
      .where(eq(trainingHistory.experimentId, experiment.id))
      .orderBy(asc(trainingHistory.epoch)),
    db
      .select({ id: findings.id })
      .from(findingExperiments)
      .innerJoin(findings, eq(findings.id, findingExperiments.findingId))
      .innerJoin(researchQuestions, eq(researchQuestions.id, findings.questionId))
      .where(findingCond)
      .orderBy(asc(findings.id)),
  ]);
  return {
    ...experiment,
    figures: figureRows.map(toFigure),
    trainingHistory: history.map((h) => ({
      epoch: h.epoch,
      trainLoss: h.trainLoss === null ? null : Number(h.trainLoss),
      valLoss: h.valLoss === null ? null : Number(h.valLoss),
    })),
    findingIds: findingRows.map((f) => f.id),
  };
}

/** Questions with nested findings. Public mode filters drafts and links to draft experiments. */
export async function loadQuestions(db: Db, publishedOnly: boolean): Promise<ResearchQuestion[]> {
  const [questionRows, findingRows, links] = await Promise.all([
    db
      .select()
      .from(researchQuestions)
      .where(publishedOnly ? eq(researchQuestions.status, 'published') : undefined)
      .orderBy(asc(researchQuestions.sortOrder), asc(researchQuestions.id)),
    db
      .select()
      .from(findings)
      .where(publishedOnly ? eq(findings.status, 'published') : undefined)
      .orderBy(asc(findings.sortOrder), asc(findings.id)),
    db
      .select({
        findingId: findingExperiments.findingId,
        experimentId: findingExperiments.experimentId,
      })
      .from(findingExperiments)
      .innerJoin(experiments, eq(experiments.id, findingExperiments.experimentId))
      .where(publishedOnly ? eq(experiments.status, 'published') : undefined)
      .orderBy(asc(experiments.sortOrder), asc(experiments.id)),
  ]);
  const linksBy = groupBy(links, (l) => l.findingId);
  const findingsBy = groupBy(
    findingRows.map((f) => toFinding(f, (linksBy.get(f.id) ?? []).map((l) => l.experimentId))),
    (f) => f.questionId,
  );
  return questionRows.map((q) => toQuestion(q, findingsBy.get(q.id) ?? []));
}

/** One question (any status) with all its findings, for admin responses. */
export async function loadQuestion(db: Db, id: number): Promise<ResearchQuestion | null> {
  const all = await loadQuestions(db, false);
  return all.find((q) => q.id === id) ?? null;
}

export async function loadFinding(db: Db, id: number): Promise<Finding | null> {
  const [row] = await db.select().from(findings).where(eq(findings.id, id));
  if (!row) return null;
  const links = await db
    .select({ experimentId: findingExperiments.experimentId })
    .from(findingExperiments)
    .where(eq(findingExperiments.findingId, id))
    .orderBy(asc(findingExperiments.experimentId));
  return toFinding(
    row,
    links.map((l) => l.experimentId),
  );
}

export async function loadComparisonSets(db: Db, publishedOnly: boolean): Promise<ComparisonSet[]> {
  const [sets, members] = await Promise.all([
    db.select().from(comparisonSets).orderBy(asc(comparisonSets.sortOrder), asc(comparisonSets.id)),
    db
      .select({ setId: comparisonSetExperiments.setId, experimentId: comparisonSetExperiments.experimentId })
      .from(comparisonSetExperiments)
      .innerJoin(experiments, eq(experiments.id, comparisonSetExperiments.experimentId))
      .where(publishedOnly ? eq(experiments.status, 'published') : undefined)
      .orderBy(asc(experiments.sortOrder), asc(experiments.id)),
  ]);
  const membersBy = groupBy(members, (m) => m.setId);
  return sets.map((s) => toComparisonSet(s, (membersBy.get(s.id) ?? []).map((m) => m.experimentId)));
}
