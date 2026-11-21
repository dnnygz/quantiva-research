import { useMemo, useRef, type KeyboardEvent } from 'react';
import { AGGREGATION_LABELS, metricDefinition, type Experiment } from '@qa/shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ModelDot } from '@/components/science/badges';
import { useResearch } from '@/hooks/research-data';
import { inkOn, modelRank, scaleFor, type ColorScale } from '@/lib/colors';
import { formatPublished, formatValue } from '@/lib/format';
import {
  columnKey,
  measureLabel,
  numericValue,
  readMeasure,
  rowKey,
  type Measure,
  type MeasureValue,
} from '@/lib/measures';
import { cn } from '@/lib/utils';

interface Column {
  key: string;
  model: string;
  variant: string | null;
}

function buildColumns(experiments: Experiment[]): Column[] {
  const map = new Map<string, Column & { order: number }>();
  for (const e of experiments) {
    const key = columnKey(e);
    if (!map.has(key)) map.set(key, { key, model: e.modelName, variant: e.variant, order: e.sortOrder });
  }
  return [...map.values()].sort(
    (a, b) => modelRank(a.model) - modelRank(b.model) || (a.variant ? 1 : 0) - (b.variant ? 1 : 0) || a.order - b.order,
  );
}

function cellText(metricName: string, v: MeasureValue) {
  if (v.kind === 'value') return formatValue(metricName, v.value);
  if (v.kind === 'range') return `${formatValue(metricName, v.min)}–${formatValue(metricName, v.max)}`;
  return 'n/a';
}

function Legend({ scale, metricName, hasMissing }: { scale: ColorScale; metricName: string; hasMissing: boolean }) {
  const def = metricDefinition(metricName);
  const gradient = `linear-gradient(90deg, ${scale.ramp.join(',')})`;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-3">
      <div className="flex items-center gap-2">
        <span className="tabular">{formatValue(metricName, scale.domain[0])}</span>
        <span className="h-2.5 w-28 rounded-full ring-1 ring-line" style={{ background: gradient }} aria-hidden />
        <span className="tabular">{formatValue(metricName, scale.domain[1])}</span>
      </div>
      <span>
        {def.direction === 'higher' && 'Teal scale · darker = higher = better'}
        {def.direction === 'lower' && 'Lavender scale · darker = larger = worse'}
        {def.direction === 'diverging' && 'Coral = negative · gray = zero · teal = positive'}
        {def.direction === 'neutral' && 'Darker = larger value'}
      </span>
      {hasMissing && (
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-[repeating-linear-gradient(135deg,#eef4f8_0_3px,#dde8f0_3px_6px)] ring-1 ring-line" />
          Not reported
        </span>
      )}
    </div>
  );
}

export interface HeatmapSelection {
  experimentId: number;
  measureKey: string;
}

/**
 * Interactive metric heatmap.
 *  - Matrix mode (several datasets / tasks / folds): rows × models for one measure, one color scale.
 *  - Profile mode (a single dataset): models × measures, each column with its own scale and direction.
 */
export function MetricHeatmap({
  experiments,
  measure,
  measures,
  selection,
  onSelect,
  rowLabel = 'Dataset',
  caption,
}: {
  experiments: Experiment[];
  measure: Measure;
  measures: Measure[];
  selection: HeatmapSelection | null;
  onSelect: (s: HeatmapSelection) => void;
  rowLabel?: string;
  caption?: string;
}) {
  const { datasets } = useResearch();
  const gridRef = useRef<HTMLTableElement>(null);

  const rows = useMemo(() => {
    const keys: string[] = [];
    for (const e of [...experiments].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const k = rowKey(e, datasets);
      if (!keys.includes(k)) keys.push(k);
    }
    return keys;
  }, [experiments, datasets]);
  const columns = useMemo(() => buildColumns(experiments), [experiments]);
  const profile = rows.length === 1;

  const lookup = useMemo(() => {
    const m = new Map<string, Experiment>();
    for (const e of experiments) m.set(`${rowKey(e, datasets)}::${columnKey(e)}`, e);
    return m;
  }, [experiments, datasets]);

  // Matrix: one scale for the measure. Profile: one scale per measure column.
  const scales = useMemo(() => {
    const out = new Map<string, ColorScale>();
    const target = profile ? measures : [measure];
    for (const ms of target) {
      const values = experiments
        .map((e) => numericValue(readMeasure(e, ms)))
        .filter((v): v is number => v !== null);
      out.set(ms.key, scaleFor(ms.metricName, values));
    }
    return out;
  }, [experiments, measure, measures, profile]);

  const header: Array<{ key: string; label: React.ReactNode; title: string }> = profile
    ? measures.map((ms) => ({ key: ms.key, label: measureLabel(ms, { short: true }), title: measureLabel(ms) }))
    : columns.map((c) => ({
        key: c.key,
        title: c.key,
        label: (
          <span className="flex flex-col items-center gap-0.5">
            <span className="flex items-center gap-1.5">
              <ModelDot model={c.model} />
              {c.model}
            </span>
            {c.variant && <span className="text-[0.68rem] font-medium text-ink-3">{c.variant}</span>}
          </span>
        ),
      }));

  const bodyRows: Array<{ key: string; label: React.ReactNode; cells: Array<{ exp?: Experiment; ms: Measure }> }> = profile
    ? columns.map((c) => ({
        key: c.key,
        label: (
          <span className="flex items-center gap-2">
            <ModelDot model={c.model} />
            <span>
              {c.model}
              {c.variant && <span className="block text-[0.7rem] font-medium text-ink-3">{c.variant}</span>}
            </span>
          </span>
        ),
        cells: measures.map((ms) => ({ exp: lookup.get(`${rows[0]}::${c.key}`), ms })),
      }))
    : rows.map((r) => ({
        key: r,
        label: r,
        cells: columns.map((c) => ({ exp: lookup.get(`${r}::${c.key}`), ms: measure })),
      }));

  let hasMissing = false;

  function onKeyDown(e: KeyboardEvent<HTMLTableElement>) {
    const target = e.target as HTMLElement;
    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);
    if (Number.isNaN(r)) return;
    const delta: Record<string, [number, number]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const next = gridRef.current?.querySelector<HTMLElement>(`[data-r="${r + d[0]}"][data-c="${c + d[1]}"]`);
    next?.focus();
  }

  return (
    <div>
      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-2">
        <table
          ref={gridRef}
          onKeyDown={onKeyDown}
          className="w-full border-separate border-spacing-1.5 text-sm"
          aria-label={caption ?? `${measureLabel(measure)} heatmap`}
        >
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-white/95 px-2 text-left align-bottom text-xs font-semibold text-ink-3">
                {profile ? 'Model' : rowLabel}
              </th>
              {header.map((h) => (
                <th key={h.key} scope="col" title={h.title} className="min-w-[78px] px-1 pb-1 text-center align-bottom text-xs font-semibold text-ink-2">
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={row.key}>
                <th scope="row" className="sticky left-0 z-10 bg-white/95 pr-3 pl-2 text-left text-[0.82rem] font-semibold whitespace-nowrap text-ink">
                  {row.label}
                </th>
                {row.cells.map(({ exp, ms }, ci) => {
                  const v: MeasureValue = exp ? readMeasure(exp, ms) : { kind: 'missing' };
                  const num = numericValue(v);
                  const scale = scales.get(ms.key);
                  const bg = num !== null && scale ? scale.color(num) : undefined;
                  if (num === null) hasMissing = true;
                  const selected = !!exp && selection?.experimentId === exp.id && selection.measureKey === ms.key;
                  const label = exp
                    ? `${exp.title}. ${measureLabel(ms)}: ${num === null ? 'not reported' : cellText(ms.metricName, v)}`
                    : 'No experiment for this combination';
                  const cell = (
                    <button
                      type="button"
                      data-r={ri}
                      data-c={ci}
                      disabled={!exp}
                      aria-label={label}
                      aria-pressed={selected}
                      onClick={() => exp && onSelect({ experimentId: exp.id, measureKey: ms.key })}
                      className={cn(
                        'tabular relative flex h-12 w-full min-w-[78px] items-center justify-center rounded-xl text-[0.85rem] font-semibold transition-all duration-200 outline-none',
                        num === null
                          ? 'bg-[repeating-linear-gradient(135deg,#f3f7fa_0_5px,#e6eef4_5px_10px)] text-ink-3'
                          : 'hover:scale-[1.04] hover:shadow-soft',
                        selected && 'ring-2 ring-[#17324d] ring-offset-2 ring-offset-white',
                        'focus-visible:ring-2 focus-visible:ring-[#2aa6cc] focus-visible:ring-offset-2',
                        !exp && 'cursor-default opacity-60',
                      )}
                      style={bg ? { background: bg, color: inkOn(bg) } : undefined}
                    >
                      {num === null ? (exp ? 'n/a' : '') : cellText(ms.metricName, v)}
                    </button>
                  );
                  return (
                    <td key={ci} className="p-0">
                      {exp ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{cell}</TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="font-semibold">{exp.title}</p>
                            <p className="mt-1 text-ink-2">
                              {measureLabel(ms)}:{' '}
                              <span className="tabular font-semibold text-ink">
                                {v.kind === 'value'
                                  ? formatPublished(v.value)
                                  : v.kind === 'range'
                                    ? `${formatPublished(v.min)}–${formatPublished(v.max)} (range)`
                                    : 'not reported in the manuscripts'}
                              </span>
                            </p>
                            {v.kind !== 'missing' && (
                              <p className="mt-0.5 text-ink-3">
                                {v.metric.aggregation ? AGGREGATION_LABELS[v.metric.aggregation] : 'Value'}
                                {v.metric.source ? ` · ${v.metric.source}` : ''}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        {profile ? (
          <p className="text-xs text-ink-3">
            Each column has its own scale. Teal: higher is better · Lavender: lower is better (darker = worse) · Hatched: not reported.
          </p>
        ) : (
          scales.get(measure.key) && (
            <Legend scale={scales.get(measure.key)!} metricName={measure.metricName} hasMissing={hasMissing} />
          )
        )}
      </div>
    </div>
  );
}
