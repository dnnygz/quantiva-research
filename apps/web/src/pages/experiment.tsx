import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  FileText,
  FlaskConical,
  Images,
  LineChart,
  ShieldAlert,
} from 'lucide-react';
import {
  AGGREGATION_LABELS,
  FACTOR_LABELS,
  SPLIT_LABELS,
  metricDefinition,
  type ExperimentDetail,
  type Metric,
} from '@qa/shared';
import { GlassCard, Panel } from '@/components/aero/glass-card';
import { SectionHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Segmented, SegmentedItem } from '@/components/ui/toggle-group';
import { AgreementBadge, LineBadge, ModelDot } from '@/components/science/badges';
import { ModelComparisonChart } from '@/components/science/model-comparison-chart';
import { TrainingCurve } from '@/components/science/training-curve';
import { FigureViewer } from '@/components/science/figure-viewer';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/feedback/states';
import { BubbleField } from '@/components/aero/bubbles';
import { useResearch } from '@/hooks/research-data';
import { useAsync } from '@/hooks/use-async';
import { api, ApiError } from '@/lib/api';
import { formatPublished } from '@/lib/format';
import { columnKey, defaultMeasure, measureKey, measureLabel, measuresFor, readMeasure, rowKey } from '@/lib/measures';
import { modelRank } from '@/lib/colors';

export default function ExperimentPage() {
  const { slug = '' } = useParams();
  const { state, reload } = useAsync((signal) => api.get<ExperimentDetail>(`/experiments/${slug}`, signal), [slug]);

  if (state.status === 'loading') return <PageSkeleton />;
  if (state.status === 'error') {
    if (state.error instanceof ApiError && state.error.status === 404)
      return (
        <div className="py-24">
          <EmptyState
            title="Experiment not found"
            description="It may be unpublished or the address may be wrong."
            action={
              <Button asChild variant="aero">
                <Link to="/explore">Back to Explore</Link>
              </Button>
            }
          />
        </div>
      );
    return <ErrorState error={state.error} onRetry={reload} />;
  }
  return <ExperimentView exp={state.data} />;
}

function ExperimentView({ exp }: { exp: ExperimentDetail }) {
  const data = useResearch();
  const line = data.lines.get(exp.researchLineId);
  const ds = exp.datasetId != null ? data.datasets.get(exp.datasetId) : undefined;
  const protocol = data.protocols.get(exp.protocolId);
  const sets = data.catalog.comparisonSets.filter((s) => s.experimentIds.includes(exp.id));
  const [setId, setSetId] = useState(sets[0]?.id);
  const set = sets.find((s) => s.id === setId) ?? sets[0];

  const ownMeasures = measuresFor([exp]).filter(
    (m) => !m.metricName.startsWith('param_count') && m.metricName !== 'geometry_ratio',
  );
  const [selectedKey, setSelectedKey] = useState(defaultMeasure(ownMeasures)?.key);
  const measure = ownMeasures.find((m) => m.key === selectedKey) ?? ownMeasures[0];

  const peers = useMemo(() => {
    if (!set || !measure) return [];
    const myRow = rowKey(exp, data.datasets);
    return set.experimentIds
      .map((id) => data.experimentsById.get(id))
      .filter((e) => !!e && rowKey(e, data.datasets) === myRow)
      .map((e) => ({ e: e!, v: readMeasure(e!, measure) }))
      .filter((x) => x.v.kind !== 'missing')
      .sort((a, b) => modelRank(a.e.modelName) - modelRank(b.e.modelName) || a.e.sortOrder - b.e.sortOrder);
  }, [set, measure, exp, data]);

  const findings = data.questions.flatMap((q) =>
    q.findings.filter((f) => exp.findingIds.includes(f.id)).map((f) => ({ q, f })),
  );

  const config = Object.entries(exp.configuration ?? {});
  // Same order as everywhere else: by metric catalog, held-out split first.
  const order = measuresFor([exp]).map((m) => m.key);
  const rank = (m: { metricName: string; split: Metric['split'] }) => {
    const i = order.indexOf(measureKey(m.metricName, m.split));
    return i === -1 ? order.length : i;
  };
  const metricRows = [...exp.metrics].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.id - b.id,
  );

  return (
    <article className="pb-6">
      <div className="pt-8">
        <Button asChild variant="ghost" size="sm">
          <Link to={line ? `/explore?line=${line.slug}` : '/explore'}>
            <ArrowLeft /> Explore
          </Link>
        </Button>
      </div>

      {/* Header */}
      <GlassCard gloss className="relative mt-4 overflow-hidden p-6 sm:p-9">
        <BubbleField preset="section" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            {line && <LineBadge line={line} />}
            <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-ink-2 ring-1 ring-line">
              {FACTOR_LABELS[exp.factor] ?? exp.factor}
            </span>
          </div>
          <h1 className="mt-4 max-w-4xl text-2xl font-bold sm:text-[2.2rem] sm:leading-tight">{exp.title}</h1>
          {exp.objective && <p className="mt-3 max-w-3xl leading-relaxed text-ink-2">{exp.objective}</p>}
          <dl className="mt-6 grid gap-4 border-t border-white pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="eyebrow">Model</dt>
              <dd className="mt-1 flex items-center gap-2 font-semibold">
                <ModelDot model={exp.modelName} /> {exp.modelName}
                {exp.variant && <span className="font-medium text-ink-3">· {exp.variant}</span>}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Dataset</dt>
              <dd className="mt-1 font-semibold">{ds?.name ?? 'Multiple datasets'}</dd>
              {exp.setting && <dd className="text-ink-3">{exp.setting}</dd>}
            </div>
            <div>
              <dt className="eyebrow">Protocol</dt>
              <dd className="mt-1 font-semibold">{protocol?.name}</dd>
            </div>
            <div>
              <dt className="eyebrow">Source</dt>
              <dd className="mt-1 font-semibold">{exp.source}</dd>
            </div>
          </dl>
        </div>
      </GlassCard>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Metrics */}
          <Panel className="p-5 sm:p-6">
            <SectionHeader icon={<FlaskConical />} title="Metrics" description="Each value as published, with its split and aggregation level." />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {metricRows.map((m) => {
                const def = metricDefinition(m.metricName);
                return (
                  <div key={m.id} className="rounded-2xl bg-gradient-to-b from-[#f5fbff] to-white p-4 ring-1 ring-line">
                    <p className="text-xs font-semibold text-ink-2">
                      {def.label}
                      {m.split && m.metricName !== 'gen_gap' && <span className="font-medium text-ink-3"> · {SPLIT_LABELS[m.split]}</span>}
                    </p>
                    <p className="tabular mt-1 text-[1.7rem] leading-tight font-bold">
                      {formatPublished(m.value)}
                      {m.unit && <span className="ml-1 text-sm font-medium text-ink-3">{m.unit}</span>}
                    </p>
                    <p className="mt-1 text-[0.72rem] text-ink-3">
                      {m.aggregation ? AGGREGATION_LABELS[m.aggregation] : 'Reported value'}
                      {m.source && m.source !== exp.source ? ` · ${m.source}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-ink-3">
              Metrics not listed were not reported for this configuration. Direction:{' '}
              {ownMeasures
                .map((m) => metricDefinition(m.metricName))
                .filter((d, i, arr) => arr.findIndex((x) => x.key === d.key) === i && d.direction !== 'neutral')
                .map((d) => `${d.short} ${d.direction === 'higher' ? '↑ better' : d.direction === 'lower' ? '↓ better' : '± signed'}`)
                .join(' · ')}
            </p>
          </Panel>

          {/* In context */}
          <Panel className="p-5 sm:p-6">
            <SectionHeader
              icon={<BarChart3 />}
              title="In context"
              description={
                set
                  ? `Same protocol, same ${set.rowLabel.toLowerCase()} (${rowKey(exp, data.datasets)}): “${set.name}”.`
                  : 'This experiment is not part of a comparison set.'
              }
              actions={
                sets.length > 1 && (
                  <Segmented type="single" value={String(set?.id)} onValueChange={(v) => v && setSetId(Number(v))} aria-label="Comparison set">
                    {sets.map((s) => (
                      <SegmentedItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SegmentedItem>
                    ))}
                  </Segmented>
                )
              }
            />
            {ownMeasures.length > 1 && (
              <Segmented type="single" value={measure?.key} onValueChange={(v) => v && setSelectedKey(v)} aria-label="Metric" className="mb-4">
                {ownMeasures.map((m) => (
                  <SegmentedItem key={m.key} value={m.key}>
                    {measureLabel(m, { short: true })}
                  </SegmentedItem>
                ))}
              </Segmented>
            )}
            {measure && peers.length > 1 ? (
              <ModelComparisonChart
                metricName={measure.metricName}
                ariaLabel={`${measureLabel(measure)} for configurations in the same comparison set`}
                items={peers.map(({ e, v }) => ({
                  id: e.id,
                  label: columnKey(e),
                  model: e.modelName,
                  value: v.kind === 'range' ? [v.min, v.max] : v.kind === 'value' ? v.value : 0,
                  highlight: e.id === exp.id,
                }))}
              />
            ) : (
              <EmptyState compact title="No compatible peers for this metric" description="Only results under the same protocol and setting are shown together." />
            )}
          </Panel>

          {/* Training curve */}
          <Panel className="p-5 sm:p-6">
            <SectionHeader icon={<LineChart />} title="Training curve" />
            <TrainingCurve points={exp.trainingHistory} />
          </Panel>

          {/* Figures */}
          {exp.figures.length > 0 && (
            <section>
              <SectionHeader icon={<Images />} title="Figures" />
              <ul className="grid gap-3 sm:grid-cols-2">
                {exp.figures.map((f) => (
                  <li key={f.id}>
                    <FigureViewer figure={f} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Side: methodology */}
        <section aria-label="Methodology and context" className="space-y-4">
          <GlassCard className="p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <FileText className="size-4 text-primary-600" /> Methodology
            </h2>
            {exp.description && <p className="mt-3 text-sm leading-relaxed text-ink-2">{exp.description}</p>}
            {protocol && (
              <div className="mt-4 rounded-2xl bg-white/80 p-3.5 ring-1 ring-white">
                <p className="text-xs font-semibold text-ink">{protocol.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">{protocol.evaluation}</p>
                <p className="mt-2 text-xs leading-relaxed text-ink-3">{protocol.description}</p>
              </div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {[
                ['Seeds', exp.nSeeds],
                ['Folds', exp.nFolds],
                ['Fold', exp.fold],
                ['Seed', exp.seed],
              ]
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([k, v]) => (
                  <div key={String(k)} className="rounded-xl bg-white/70 px-3 py-2">
                    <dt className="text-[0.7rem] text-ink-3">{k}</dt>
                    <dd className="tabular font-semibold">{String(v)}</dd>
                  </div>
                ))}
            </dl>
            {config.length > 0 && (
              <>
                <p className="eyebrow mt-4">Configuration</p>
                <dl className="mt-2 divide-y divide-line/70 text-sm">
                  {config.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 py-1.5">
                      <dt className="text-ink-3">{k.replace(/_/g, ' ')}</dt>
                      <dd className="tabular text-right font-medium">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </GlassCard>

          {(exp.observations || exp.limitations || protocol?.limitations) && (
            <div className="panel rounded-3xl p-5">
              {exp.observations && (
                <>
                  <h2 className="text-base font-bold">Observations</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{exp.observations}</p>
                </>
              )}
              <h2 className={`flex items-center gap-2 text-base font-bold ${exp.observations ? 'mt-5' : ''}`}>
                <ShieldAlert className="size-4 text-[#b45309]" /> Limitations
              </h2>
              {exp.limitations && <p className="mt-2 text-sm leading-relaxed text-ink-2">{exp.limitations}</p>}
              {protocol?.limitations && <p className="mt-2 text-sm leading-relaxed text-ink-3">{protocol.limitations}</p>}
            </div>
          )}

          {findings.length > 0 && (
            <div className="panel rounded-3xl p-5">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <BookOpenCheck className="size-4 text-primary-600" /> Cited in the synthesis
              </h2>
              <ul className="mt-3 space-y-2">
                {findings.map(({ q, f }) => (
                  <li key={f.id}>
                    <Link to={`/compare?mode=synthesis#${q.slug}`} className="block rounded-2xl bg-muted/70 p-3 text-sm transition-colors hover:bg-primary-50">
                      <span className="font-semibold">{q.question}</span>
                      <span className="mt-1.5 block">
                        <AgreementBadge agreement={q.agreement} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
