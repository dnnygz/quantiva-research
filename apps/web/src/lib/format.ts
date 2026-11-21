import { metricDefinition, type Metric } from '@qa/shared';

export function formatValue(metricName: string, value: number | null | undefined, decimals?: number) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const d = decimals ?? metricDefinition(metricName).decimals;
  const s = value.toFixed(d);
  return metricDefinition(metricName).direction === 'diverging' && value > 0 ? `+${s}` : s;
}

/** Values as published: show the precision the manuscript used (up to 6 decimals). */
export function formatPublished(value: number) {
  const s = String(value);
  const decimals = s.includes('.') ? s.split('.')[1]!.length : 0;
  return value.toFixed(Math.min(Math.max(decimals, 3), 6));
}

export function formatSigned(value: number, decimals = 3) {
  const s = Math.abs(value).toFixed(decimals);
  if (Number(s) === 0) return s;
  return value > 0 ? `+${s}` : `−${s}`;
}

export function metricRangeLabel(metrics: Metric[]) {
  const lo = metrics.find((m) => m.aggregation === 'range_min');
  const hi = metrics.find((m) => m.aggregation === 'range_max');
  if (!lo || !hi) return null;
  return `${formatPublished(lo.value)}–${formatPublished(hi.value)}`;
}
