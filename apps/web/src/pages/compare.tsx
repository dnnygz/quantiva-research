import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { BarChart3, BookOpenCheck, Grid3x3, Info, SlidersHorizontal, Table2, TriangleAlert } from 'lucide-react';
import { AGGREGATION_LABELS, AGREEMENT_LABELS, type Experiment } from '@qa/shared';
import { PageHeader, SectionHeader } from '@/components/layout/page-header';
import { GlassCard, Panel } from '@/components/aero/glass-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Segmented, SegmentedItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterSelect } from '@/components/science/experiment-filters';
import { ModelComparisonChart } from '@/components/science/model-comparison-chart';
import { MetricHeatmap, type HeatmapSelection } from '@/components/science/metric-heatmap';
import { EvidenceComparison } from '@/components/science/evidence';
import { ModelDot } from '@/components/science/badges';
import { EmptyState } from '@/components/feedback/states';
import { useResearch } from '@/hooks/research-data';
import { modelRank } from '@/lib/colors';
import { formatPublished, formatSigned } from '@/lib/format';
import { columnKey, defaultMeasure, measureLabel, measuresFor, readMeasure, rowKey } from '@/lib/measures';
import { cn } from '@/lib/utils';

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'synthesis' ? 'synthesis' : 'quantitative';
  return (
    <div>
      <PageHeader
        eyebrow="Compare"
        title="Compare models and evidence"
        description="Quantitative comparisons stay inside one protocol-compatible set. Across research lines, findings are compared qualitatively."
      />
      <Tabs
        value={mode}
        onValueChange={(v) =>
          setParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              if (v === 'synthesis') n.set('mode', 'synthesis');
              else n.delete('mode');
              return n;
            },
            { preventScrollReset: true },
          )
        }
      >
        <TabsList aria-label="Comparison mode">
          <TabsTrigger value="quantitative">
            <BarChart3 /> Model comparison
          </TabsTrigger>
          <TabsTrigger value="synthesis">
            <BookOpenCheck /> Evidence synthesis
          </TabsTrigger>
        </TabsList>
        <TabsContent value="quantitative">
          <QuantitativeComparison />
        </TabsContent>
        <TabsContent value="synthesis">
          <EvidenceSynthesis />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quantitative model comparison
// ---------------------------------------------------------------------------

function QuantitativeComparison() {
  const data = useResearch();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) (v === null ? n.delete(k) : n.set(k, v));
        return n;
      },
      { replace: true, preventScrollReset: true },
    );

  const lines = data.catalog.researchLines;
  const line = data.lineBySlug.get(params.get('line') ?? '') ?? lines[0]!;
  const sets = data.catalog.comparisonSets.filter((s) => s.researchLineId === line.id);
  const set = sets.find((s) => s.slug === params.get('set')) ?? sets[0];
  const protocol = set ? data.protocols.get(set.protocolId) : undefined;

  const setExps = useMemo(
    () => (set ? set.experimentIds.map((id) => data.experimentsById.get(id)).filter((e): e is Experiment => !!e) : []),
    [set, data.experimentsById],
  );
  const rows = useMemo(() => {
    const r: string[] = [];
    for (const e of [...setExps].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const k = rowKey(e, data.datasets);
      if (!r.includes(k)) r.push(k);
    }
    return r;
  }, [setExps, data.datasets]);
  const row = rows.find((r) => r === params.get('row')) ?? rows[0];

  const measures = useMemo(
    () => measuresFor(setExps).filter((m) => !m.metricName.startsWith('param_count') && m.metricName !== 'geometry_ratio'),
    [setExps],
  );
  const measure = measures.find((m) => m.key === params.get('measure')) ?? defaultMeasure(measures);

  const rowExps = useMemo(
    () =>
      setExps
        .filter((e) => rowKey(e, data.datasets) === row)
        .sort((a, b) => modelRank(a.modelName) - modelRank(b.modelName) || a.sortOrder - b.sortOrder),
    [setExps, row, data.datasets],
  );
  const allColumns = useMemo(() => [...new Set(setExps.map(columnKey))], [setExps]);
  const excluded = new Set((params.get('hide') ?? '').split('~').filter(Boolean));
  const shown = rowExps.filter((e) => !excluded.has(columnKey(e)));
  const withValue = measure ? shown.filter((e) => readMeasure(e, measure).kind !== 'missing') : [];
  const missing = measure ? shown.filter((e) => readMeasure(e, measure).kind === 'missing') : [];

  const refKey = params.get('ref');
  const pointRows = withValue.filter((e) => readMeasure(e, measure!).kind === 'value');
  const reference =
    pointRows.find((e) => columnKey(e) === refKey) ?? pointRows.find((e) => e.modelName === 'VQC') ?? pointRows[0];
  const refValue = reference && measure ? readMeasure(reference, measure) : undefined;

  const toggleColumn = (key: string) => {
    const next = new Set(excluded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update({ hide: next.size ? [...next].join('~') : null });
  };

  const [selection, setSelection] = useState<HeatmapSelection | null>(null);
  const heatmapExps = setExps.filter((e) => !excluded.has(columnKey(e)));

  const filters = (
    <div className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-[0.72rem] font-semibold text-ink-3">1 · Research line</span>
        <Segmented
          type="single"
          value={line.slug}
          aria-label="Research line"
          onValueChange={(v) => v && update({ line: v, set: null, row: null, measure: null, hide: null, ref: null })}
        >
          {lines.map((l) => (
            <SegmentedItem key={l.slug} value={l.slug}>
              Line {l.code}
            </SegmentedItem>
          ))}
        </Segmented>
        <p className="px-1 text-xs text-ink-3">{line.name}</p>
      </div>
      <FilterSelect
        label="2 · Compatible comparison set"
        value={set?.slug ?? null}
        allLabel="—"
        options={sets.map((s) => ({ value: s.slug, label: s.name }))}
        onChange={(v) => v && update({ set: v, row: null, measure: null, hide: null, ref: null })}
      />
      {rows.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span id="row-select" className="px-1 text-[0.72rem] font-semibold text-ink-3">
            3 · {set?.rowLabel ?? 'Dataset'}
          </span>
          <Select value={row} onValueChange={(v) => update({ row: v })}>
            <SelectTrigger aria-labelledby="row-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rows.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {measure && (
        <div className="flex flex-col gap-1.5">
          <span id="measure-select" className="px-1 text-[0.72rem] font-semibold text-ink-3">
            4 · Metric
          </span>
          <Select value={measure.key} onValueChange={(v) => update({ measure: v, ref: null })}>
            <SelectTrigger aria-labelledby="measure-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {measures.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {measureLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 px-1 text-[0.72rem] font-semibold text-ink-3">5 · Models / configurations</legend>
        <div className="flex flex-wrap gap-1.5">
          {allColumns.map((key) => {
            const exp = setExps.find((e) => columnKey(e) === key)!;
            const on = !excluded.has(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleColumn(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-all',
                  on ? 'bg-white text-ink shadow-soft ring-line-strong' : 'bg-transparent text-ink-3 ring-line line-through decoration-ink-3/50',
                )}
              >
                <ModelDot model={exp.modelName} className={cn(!on && 'opacity-40')} />
                {key}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Filters */}
      <section aria-label="Comparison filters" className="lg:sticky lg:top-24 lg:self-start">
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-center justify-between lg:hidden">
            <p className="text-sm font-semibold">
              {line.code} · {set?.name}
            </p>
            <Button variant="outline" size="sm" aria-expanded={filtersOpen} aria-controls="compare-filters" onClick={() => setFiltersOpen((v) => !v)}>
              <SlidersHorizontal /> {filtersOpen ? 'Hide' : 'Adjust'}
            </Button>
          </div>
          <div id="compare-filters" className={cn('mt-4 lg:mt-0 lg:block', filtersOpen ? 'block' : 'hidden')}>
            {filters}
          </div>
        </GlassCard>
      </section>

      <div className="min-w-0 space-y-6">
        {/* Methodological context */}
        {set && protocol && (
          <div className="flex gap-3 rounded-3xl bg-gradient-to-r from-[#e8f6fc] to-[#f0edff] p-4 ring-1 ring-white sm:p-5">
            <Info className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold">{set.name}</p>
              <p className="mt-0.5 text-ink-2">{set.description}</p>
              <p className="mt-2 text-ink-3">
                <span className="font-semibold text-ink-2">Protocol · </span>
                {protocol.evaluation}. All values in this view share it, so they can be compared directly.
              </p>
            </div>
          </div>
        )}

        {/* Bars */}
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            icon={<BarChart3 />}
            title={measure ? measureLabel(measure) : 'Comparison'}
            description={row ? `${set?.rowLabel ?? 'Dataset'}: ${row}` : undefined}
          />
          {measure && withValue.length > 0 ? (
            <ModelComparisonChart
              metricName={measure.metricName}
              ariaLabel={`${measureLabel(measure)} by configuration on ${row}`}
              items={withValue.map((e) => {
                const v = readMeasure(e, measure);
                return {
                  id: e.id,
                  label: columnKey(e),
                  model: e.modelName,
                  value: v.kind === 'range' ? [v.min, v.max] : v.kind === 'value' ? v.value : 0,
                  note: v.kind !== 'missing' && v.metric.aggregation ? AGGREGATION_LABELS[v.metric.aggregation] : undefined,
                };
              })}
            />
          ) : (
            <EmptyState compact title="Nothing to plot" description="No selected configuration reports this metric here." />
          )}
          {missing.length > 0 && (
            <p className="mt-3 text-xs text-ink-3">
              Not reported for this metric: {missing.map(columnKey).join(', ')}.
            </p>
          )}
        </Panel>

        {/* Table */}
        {measure && withValue.length > 0 && (
          <Panel className="p-5 sm:p-6">
            <SectionHeader
              icon={<Table2 />}
              title="Metric table"
              description="Published values with their aggregation level. Δ is a descriptive difference of published means within this set — not a statistical test."
              actions={
                pointRows.length > 1 && reference ? (
                  <div className="flex items-center gap-2 text-xs text-ink-3">
                    <span id="ref-label">Δ relative to</span>
                    <Select value={columnKey(reference)} onValueChange={(v) => update({ ref: v })}>
                      <SelectTrigger aria-labelledby="ref-label" className="h-8 w-auto min-w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pointRows.map((e) => (
                          <SelectItem key={e.id} value={columnKey(e)}>
                            {columnKey(e)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : undefined
              }
            />
            <div className="scrollbar-thin -mx-2 overflow-x-auto px-2">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-3">
                    <th scope="col" className="py-2 pr-3 font-semibold">Configuration</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">{measureLabel(measure, { short: true })}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Δ vs {reference ? columnKey(reference) : '—'}</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Aggregation</th>
                    <th scope="col" className="py-2 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {withValue.map((e) => {
                    const v = readMeasure(e, measure);
                    const isRef = reference?.id === e.id;
                    const delta =
                      v.kind === 'value' && refValue?.kind === 'value' && !isRef ? v.value - refValue.value : null;
                    return (
                      <tr key={e.id} className={cn('border-b border-line/60 last:border-0', isRef && 'bg-primary-50/50')}>
                        <th scope="row" className="py-2.5 pr-3 text-left font-semibold">
                          <Link to={`/experiments/${e.slug}`} className="inline-flex items-center gap-2 hover:text-primary-600 hover:underline">
                            <ModelDot model={e.modelName} />
                            {columnKey(e)}
                          </Link>
                        </th>
                        <td className="tabular py-2.5 pr-3 text-right font-semibold">
                          {v.kind === 'value' ? formatPublished(v.value) : v.kind === 'range' ? `${formatPublished(v.min)}–${formatPublished(v.max)}` : '—'}
                        </td>
                        <td className="tabular py-2.5 pr-3 text-right text-ink-2">
                          {isRef ? <span className="text-xs text-ink-3">reference</span> : delta === null ? '—' : formatSigned(delta, 3)}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-ink-3">
                          {v.kind !== 'missing' && v.metric.aggregation ? AGGREGATION_LABELS[v.metric.aggregation] : '—'}
                        </td>
                        <td className="py-2.5 text-xs text-ink-3">{v.kind !== 'missing' ? (v.metric.source ?? e.source) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {/* Heatmap across rows */}
        {measure && rows.length > 1 && (
          <Panel className="p-5 sm:p-6">
            <SectionHeader
              icon={<Grid3x3 />}
              title={`Across ${set?.rowLabel.toLowerCase() === 'dataset' ? 'datasets' : `${set?.rowLabel.toLowerCase()}s`}`}
              description="Same set and metric for every row; select a cell to jump to that row."
            />
            <MetricHeatmap
              experiments={heatmapExps}
              measure={measure}
              measures={measures}
              selection={selection}
              rowLabel={set?.rowLabel}
              onSelect={(s) => {
                setSelection(s);
                const e = data.experimentsById.get(s.experimentId);
                if (e) update({ row: rowKey(e, data.datasets) });
              }}
            />
          </Panel>
        )}

        <p className="flex gap-2 px-1 text-xs leading-relaxed text-ink-3">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Results from different research lines use different datasets and protocols (30 re-splits with a test split vs. five
          development folds × three seeds), so they are never placed on the same quantitative axis here. Use the evidence
          synthesis to compare them.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cross-line evidence synthesis
// ---------------------------------------------------------------------------

function EvidenceSynthesis() {
  const data = useResearch();
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const counts = data.questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.agreement] = (acc[q.agreement] ?? 0) + 1;
    return acc;
  }, {});

  if (data.questions.length === 0)
    return <EmptyState title="No published findings yet" description="Findings appear here once researchers publish them." />;

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <GlassCard className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">How to read this synthesis</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Each question places the findings of both lines side by side. They were written and reviewed by the researchers
            from the manuscripts — nothing here is generated automatically. Because protocols differ, agreement is judged
            qualitatively: the direction of an effect, not the size of a number.
          </p>
          <nav aria-label="Questions" className="mt-4 flex flex-wrap gap-1.5">
            {data.questions.map((q, i) => (
              <a
                key={q.slug}
                href={`#${q.slug}`}
                className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-ink-2 ring-1 ring-line transition-colors hover:bg-white hover:text-ink"
              >
                Q{i + 1} · {q.question.replace(/\?$/, '')}
              </a>
            ))}
          </nav>
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
            {(['converging', 'mixed', 'open'] as const).map((a) => (
              <span key={a} className="tabular">
                {AGREEMENT_LABELS[a]}: <span className="font-semibold text-ink-2">{counts[a] ?? 0}</span>
              </span>
            ))}
          </p>
        </GlassCard>
        <div className="panel rounded-3xl p-5">
          <h2 className="text-base font-bold">Recurring limitations</h2>
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-ink-2">
            {data.catalog.protocols.map((p) => (
              <li key={p.id}>
                <span className="text-xs font-semibold text-ink">
                  Line {data.lines.get(p.researchLineId)?.code} · {p.name}
                </span>
                <span className="mt-0.5 block text-ink-3">{p.limitations}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {data.questions.map((q) => (
        <EvidenceComparison key={q.id} question={q} />
      ))}
    </div>
  );
}
