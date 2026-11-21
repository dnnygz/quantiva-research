/**
 * A "measure" is a metric read on a specific split (e.g. ROC-AUC on the test
 * split). Heatmaps, tables and charts are always built from one measure at a
 * time, so values that mean different things are never mixed in one scale.
 */
import {
  METRIC_KEYS,
  SPLIT_LABELS,
  metricDefinition,
  type Dataset,
  type Experiment,
  type Metric,
  type Split,
} from '@qa/shared';

export interface Measure {
  key: string;
  metricName: string;
  split: Split | null;
}

export type MeasureValue =
  | { kind: 'value'; value: number; metric: Metric }
  | { kind: 'range'; min: number; max: number; metric: Metric }
  | { kind: 'missing' };

const SPLIT_ORDER: Array<Split | null> = ['test', 'validation', null, 'train'];

export function measureKey(metricName: string, split: Split | null) {
  return `${metricName}|${split ?? ''}`;
}

export function parseMeasure(key: string): Measure {
  const [metricName = '', split = ''] = key.split('|');
  return { key, metricName, split: (split || null) as Split | null };
}

export function measureLabel(m: Measure, opts: { short?: boolean } = {}) {
  const def = metricDefinition(m.metricName);
  const name = opts.short ? def.short : def.label;
  if (!m.split || m.metricName === 'gen_gap') return name;
  return `${name} · ${SPLIT_LABELS[m.split]}`;
}

/** All measures present in a list of experiments, in a stable, meaningful order. */
export function measuresFor(experiments: Experiment[]): Measure[] {
  const seen = new Map<string, Measure>();
  for (const e of experiments) {
    for (const m of e.metrics) {
      if (m.aggregation === 'std_between_fold_means') continue;
      const key = measureKey(m.metricName, m.split);
      if (!seen.has(key)) seen.set(key, { key, metricName: m.metricName, split: m.split });
    }
  }
  const metricRank = (name: string) => {
    const i = (METRIC_KEYS as string[]).indexOf(name);
    return i === -1 ? 99 : i;
  };
  return [...seen.values()].sort(
    (a, b) =>
      metricRank(a.metricName) - metricRank(b.metricName) ||
      SPLIT_ORDER.indexOf(a.split) - SPLIT_ORDER.indexOf(b.split),
  );
}

/** Preferred default measure: held-out AUC, else the first available. */
export function defaultMeasure(measures: Measure[]): Measure | undefined {
  return (
    measures.find((m) => m.metricName === 'roc_auc' && m.split === 'test') ??
    measures.find((m) => m.metricName === 'roc_auc' && m.split === 'validation') ??
    measures.find((m) => m.metricName === 'auc_difference') ??
    measures[0]
  );
}

export function readMeasure(e: Experiment, m: Measure): MeasureValue {
  const rows = e.metrics.filter((x) => x.metricName === m.metricName && x.split === m.split);
  const lo = rows.find((x) => x.aggregation === 'range_min');
  const hi = rows.find((x) => x.aggregation === 'range_max');
  if (lo && hi) return { kind: 'range', min: lo.value, max: hi.value, metric: lo };
  const point = rows.find(
    (x) => x.aggregation !== 'range_min' && x.aggregation !== 'range_max' && x.aggregation !== 'std_between_fold_means',
  );
  return point ? { kind: 'value', value: point.value, metric: point } : { kind: 'missing' };
}

export function numericValue(v: MeasureValue): number | null {
  if (v.kind === 'value') return v.value;
  if (v.kind === 'range') return (v.min + v.max) / 2;
  return null;
}

/** Column identity in heatmaps and comparisons: model plus variant. */
export function columnKey(e: Experiment) {
  return e.variant ? `${e.modelName} · ${e.variant}` : e.modelName;
}

/** Row identity: explicit setting (task, fold) or the dataset. */
export function rowKey(e: Experiment, datasets: Map<number, Dataset>) {
  if (e.setting) return e.setting;
  if (e.datasetId != null) return datasets.get(e.datasetId)?.shortName ?? 'Dataset';
  return 'All datasets';
}
