import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { FACTOR_LABELS, type Experiment } from '@qa/shared';
import { LineBadge, ModelDot } from '@/components/science/badges';
import { useResearch } from '@/hooks/research-data';
import { formatValue, metricRangeLabel } from '@/lib/format';
import { measureLabel, measuresFor, readMeasure } from '@/lib/measures';

/** Compact card: what was run, on what, and the headline numbers. */
export function ExperimentCard({ experiment: e }: { experiment: Experiment }) {
  const { lines, datasets } = useResearch();
  const line = lines.get(e.researchLineId);
  const ds = e.datasetId != null ? datasets.get(e.datasetId) : undefined;
  const ms = measuresFor([e]).filter((m) => !m.metricName.startsWith('param_count')).slice(0, 3);
  const range = metricRangeLabel(e.metrics);
  const protocolBits = [
    e.nSeeds ? `${e.nSeeds} seeds` : null,
    e.nFolds ? `${e.nFolds} folds` : null,
    e.fold != null ? `fold ${e.fold}` : null,
  ].filter(Boolean);

  return (
    <Link
      to={`/experiments/${e.slug}`}
      className="group panel flex h-full flex-col rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-600/30 hover:shadow-float"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {line && <LineBadge line={line} compact />}
          <span className="truncate text-xs font-medium text-ink-3">{FACTOR_LABELS[e.factor] ?? e.factor}</span>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-ink-3 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary-600" />
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-[0.92rem] leading-snug font-bold">{e.title}</h3>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ModelDot model={e.modelName} />
          {e.modelName}
        </span>
        {e.variant && <span className="text-ink-3">{e.variant}</span>}
        <span aria-hidden className="text-line-strong">•</span>
        <span>{ds?.shortName ?? e.setting ?? 'Multiple datasets'}</span>
        {protocolBits.length > 0 && (
          <>
            <span aria-hidden className="text-line-strong">•</span>
            <span className="text-ink-3">{protocolBits.join(' · ')}</span>
          </>
        )}
      </p>
      <dl className="mt-auto flex flex-wrap gap-1.5 pt-3">
        {range ? (
          <div className="rounded-lg bg-muted px-2 py-1">
            <dt className="text-[0.65rem] font-medium text-ink-3">Training AUC (range)</dt>
            <dd className="tabular text-sm font-bold">{range}</dd>
          </div>
        ) : (
          ms.map((m) => {
            const v = readMeasure(e, m);
            return (
              <div key={m.key} className="rounded-lg bg-muted px-2 py-1">
                <dt className="text-[0.65rem] font-medium text-ink-3">{measureLabel(m, { short: true })}</dt>
                <dd className="tabular text-sm font-bold">{v.kind === 'value' ? formatValue(m.metricName, v.value) : '—'}</dd>
              </div>
            );
          })
        )}
      </dl>
    </Link>
  );
}
