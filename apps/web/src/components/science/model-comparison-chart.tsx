import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { metricDefinition } from '@qa/shared';
import { modelColor } from '@/lib/colors';
import { useReducedMotion } from '@/hooks/use-media-query';
import { formatPublished, formatValue } from '@/lib/format';

export interface ComparisonItem {
  id: number | string;
  label: string;
  model: string;
  value: number | [number, number];
  highlight?: boolean;
  note?: string;
}

interface Row {
  id: number | string;
  label: string;
  model: string;
  value: number | [number, number];
  display: string;
  highlight: boolean;
  note?: string;
}

const BOUNDED = ['roc_auc', 'balanced_accuracy', 'recall_minority'];

function domainFor(metricName: string, items: ComparisonItem[]): [number, number] {
  const def = metricDefinition(metricName);
  const flat = items.flatMap((i) => (Array.isArray(i.value) ? i.value : [i.value]));
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  if (def.direction === 'diverging') {
    const m = Math.max(Math.abs(lo), Math.abs(hi)) * 1.25 || 0.01;
    return [-m, m];
  }
  return [Math.min(0, lo * 1.15), Math.max(0, hi * 1.15) || 1];
}

function TooltipBody({ active, payload, metricName }: { active?: boolean; payload?: Array<{ payload: Row }>; metricName: string }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const def = metricDefinition(metricName);
  return (
    <div className="rounded-xl border border-white bg-white/95 px-3 py-2 text-xs shadow-float backdrop-blur-xl">
      <p className="font-semibold text-ink">{row.label}</p>
      <p className="mt-1 text-ink-2">
        {def.label}:{' '}
        <span className="tabular font-semibold text-ink">
          {Array.isArray(row.value)
            ? `${formatPublished(row.value[0])}–${formatPublished(row.value[1])} (range)`
            : formatPublished(row.value)}
        </span>
      </p>
      {row.note && <p className="mt-0.5 text-ink-3">{row.note}</p>}
    </div>
  );
}

/**
 * Horizontal bars, one per model/configuration, colored by model identity.
 * Bounded metrics (AUC, accuracy, recall) are drawn from 0 to 1 so bar length
 * stays honest; ranges are drawn as floating bars.
 */
/**
 * Dot plot for bounded scores (AUC, accuracy, recall): position, not length,
 * encodes the value, so the axis can zoom to the observed range without
 * exaggerating differences. The zoomed range is stated under the chart.
 */
function DotPlot({ rows, ariaLabel }: { rows: Row[]; ariaLabel: string }) {
  const flat = rows.flatMap((r) => (Array.isArray(r.value) ? r.value : [r.value]));
  const span = Math.max(Math.max(...flat) - Math.min(...flat), 0.02);
  const lo = Math.max(0, Math.floor((Math.min(...flat) - span * 0.25) * 100) / 100);
  const hi = Math.min(1, Math.ceil((Math.max(...flat) + span * 0.25) * 100) / 100);
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const anyHighlight = rows.some((r) => r.highlight);
  return (
    <figure aria-label={ariaLabel} className="w-full">
      <div className="grid grid-cols-[minmax(64px,max-content)_minmax(0,1fr)_64px] items-center gap-x-3 gap-y-1">
        {rows.map((r) => (
          <div key={r.id} className="contents" style={{ opacity: anyHighlight && !r.highlight ? 0.45 : 1 }}>
            <span className={`truncate text-right text-[0.8rem] font-semibold ${anyHighlight && !r.highlight ? 'text-ink-3' : 'text-ink'}`} title={r.label}>
              {r.label}
            </span>
            <div className="group relative h-9" title={`${r.label}: ${r.display}${r.note ? ` (${r.note})` : ''}`}>
              <div className="absolute inset-x-0 top-1/2 h-px bg-[#e3edf4]" />
              {ticks.map((t) => (
                <div key={t} className="absolute top-1 bottom-1 w-px bg-[#eef4f8]" style={{ left: pos(t) }} />
              ))}
              {Array.isArray(r.value) ? (
                <div
                  className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
                  style={{ left: pos(r.value[0]), width: `calc(${pos(r.value[1])} - ${pos(r.value[0])})`, background: modelColor(r.model) }}
                />
              ) : (
                <>
                  <div
                    className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-transform group-hover:scale-125"
                    style={{ left: pos(r.value), background: modelColor(r.model), boxShadow: r.highlight ? '0 0 0 4px rgb(23 50 77 / 0.25)' : undefined }}
                  />
                </>
              )}
            </div>
            <span className="tabular text-[0.82rem] font-semibold text-ink">{r.display}</span>
          </div>
        ))}
        <span />
        <div className="relative h-5">
          {ticks.map((t) => (
            <span key={t} className="tabular absolute -translate-x-1/2 text-[0.68rem] text-ink-3" style={{ left: pos(t) }}>
              {t.toFixed(2)}
            </span>
          ))}
        </div>
        <span />
      </div>
      <figcaption className="mt-2 text-xs text-ink-3">
        Axis zoomed to {lo.toFixed(2)}–{hi.toFixed(2)}; dot position (not line length) encodes the value.
      </figcaption>
    </figure>
  );
}

export function ModelComparisonChart({
  items,
  metricName,
  height,
  ariaLabel,
}: {
  items: ComparisonItem[];
  metricName: string;
  height?: number;
  ariaLabel: string;
}) {
  const rows: Row[] = items.map((i) => ({
    ...i,
    highlight: !!i.highlight,
    display: Array.isArray(i.value)
      ? `${formatValue(metricName, i.value[0])}–${formatValue(metricName, i.value[1])}`
      : formatValue(metricName, i.value),
  }));
  const reduced = useReducedMotion();
  if (BOUNDED.includes(metricName)) return <DotPlot rows={rows} ariaLabel={ariaLabel} />;
  const anyHighlight = rows.some((r) => r.highlight);
  const h = height ?? Math.max(160, rows.length * 44 + 40);
  const domain = domainFor(metricName, items);
  const longest = Math.max(...rows.map((r) => r.label.length));

  return (
    <figure aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke="#e3edf4" />
          <XAxis
            type="number"
            domain={domain}
            tick={{ fill: '#56708a', fontSize: 11 }}
            tickFormatter={(v: number) => formatValue(metricName, v, 2)}
            axisLine={{ stroke: '#d5e6f2' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={Math.min(220, Math.max(70, longest * 6.6))}
            tick={{ fill: '#17324d', fontSize: 12, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          {domain[0] < 0 && <ReferenceLine x={0} stroke="#93afc9" />}
          <Tooltip cursor={{ fill: 'rgb(169 222 255 / 0.18)' }} content={<TooltipBody metricName={metricName} />} />
          <Bar dataKey="value" radius={4} maxBarSize={24} isAnimationActive={!reduced} animationDuration={450}>
            {rows.map((r) => (
              <Cell
                key={r.id}
                fill={modelColor(r.model)}
                fillOpacity={anyHighlight && !r.highlight ? 0.35 : 1}
                stroke={r.highlight ? '#17324d' : 'none'}
                strokeWidth={r.highlight ? 1.5 : 0}
              />
            ))}
            <LabelList dataKey="display" position="right" className="tabular" style={{ fill: '#17324d', fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
