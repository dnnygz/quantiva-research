import { Link } from 'react-router';
import { ArrowRight, MousePointerClick } from 'lucide-react';
import { AGGREGATION_LABELS, type Experiment } from '@qa/shared';
import { Button } from '@/components/ui/button';
import { ModelDot } from '@/components/science/badges';
import { useResearch } from '@/hooks/research-data';
import { formatPublished, formatValue } from '@/lib/format';
import { measureLabel, measuresFor, parseMeasure, readMeasure } from '@/lib/measures';

/** Contextual panel for the selected heatmap cell. */
export function CellContext({ experiment, measureKey }: { experiment?: Experiment; measureKey?: string }) {
  const { datasets, protocols } = useResearch();
  if (!experiment || !measureKey) {
    return (
      <div className="hidden h-full min-h-56 flex-col items-center lg:flex justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-white/50 p-6 text-center">
        <MousePointerClick className="size-5 text-ink-3" />
        <p className="text-sm font-semibold">Select a cell</p>
        <p className="text-xs text-ink-3">Its model, dataset, value, aggregation level and source will appear here.</p>
      </div>
    );
  }
  const ms = parseMeasure(measureKey);
  const v = readMeasure(experiment, ms);
  const ds = experiment.datasetId != null ? datasets.get(experiment.datasetId) : undefined;
  const protocol = protocols.get(experiment.protocolId);
  const others = measuresFor([experiment]).filter((m) => m.key !== measureKey);

  return (
    <div className="flex h-full flex-col rounded-2xl bg-gradient-to-b from-[#f3fafe] to-white p-5 ring-1 ring-line animate-rise" aria-live="polite">
      <p className="eyebrow">Selected result</p>
      <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
        <ModelDot model={experiment.modelName} />
        {experiment.modelName}
        {experiment.variant && <span className="font-medium text-ink-3">· {experiment.variant}</span>}
      </p>
      <p className="mt-0.5 text-sm text-ink-2">{experiment.setting ?? ds?.name ?? 'Multiple datasets'}</p>

      <div className="mt-4">
        <p className="text-xs font-medium text-ink-3">{measureLabel(ms)}</p>
        <p className="tabular mt-0.5 text-4xl font-bold tracking-tight">
          {v.kind === 'value'
            ? formatPublished(v.value)
            : v.kind === 'range'
              ? `${formatPublished(v.min)}–${formatPublished(v.max)}`
              : 'n/a'}
        </p>
        <p className="mt-1 text-xs text-ink-3">
          {v.kind === 'missing'
            ? 'Not reported in the paper.'
            : `${v.metric.aggregation ? AGGREGATION_LABELS[v.metric.aggregation] : 'Value'} · ${v.metric.source ?? experiment.source}`}
        </p>
      </div>

      {others.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {others.slice(0, 4).map((m) => {
            const ov = readMeasure(experiment, m);
            return (
              <div key={m.key} className="rounded-xl bg-white px-3 py-2 ring-1 ring-line">
                <dt className="truncate text-[0.68rem] text-ink-3">{measureLabel(m, { short: true })}</dt>
                <dd className="tabular text-sm font-bold">{ov.kind === 'value' ? formatValue(m.metricName, ov.value) : '—'}</dd>
              </div>
            );
          })}
        </dl>
      )}

      {protocol && <p className="mt-4 text-xs leading-relaxed text-ink-3">{protocol.evaluation}</p>}

      <Button asChild variant="subtle" size="sm" className="mt-auto self-start">
        <Link to={`/experiments/${experiment.slug}`} className="mt-4">
          Open experiment <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
