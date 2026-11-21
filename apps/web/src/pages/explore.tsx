import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Grid3x3, Images, ListFilter, SearchX } from 'lucide-react';
import { FACTOR_LABELS, metricDefinition, type Experiment, type Factor, type Figure } from '@qa/shared';
import { PageHeader, SectionHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/aero/glass-card';
import { Segmented, SegmentedItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/feedback/states';
import { FilterPanel, FilterSelect, type FilterOption } from '@/components/science/experiment-filters';
import { MetricHeatmap, type HeatmapSelection } from '@/components/science/metric-heatmap';
import { CellContext } from '@/components/science/cell-context';
import { ExperimentCard } from '@/components/science/experiment-card';
import { FigureViewer } from '@/components/science/figure-viewer';
import { Skeleton } from '@/components/ui/skeleton';
import { useResearch } from '@/hooks/research-data';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import { modelRank } from '@/lib/colors';
import { defaultMeasure, measureLabel, measuresFor } from '@/lib/measures';

type FilterKey = 'dataset' | 'factor' | 'model' | 'metric';
const FILTER_KEYS: FilterKey[] = ['dataset', 'factor', 'model', 'metric'];
const PAGE = 18;

export default function ExplorePage() {
  const data = useResearch();
  const [params, setParams] = useSearchParams();
  const [visible, setVisible] = useState(PAGE);

  const lineSlug = params.get('line');
  const line = lineSlug ? data.lineBySlug.get(lineSlug) : undefined;
  const f: Record<FilterKey, string | null> = {
    dataset: params.get('dataset'),
    factor: params.get('factor'),
    model: params.get('model'),
    metric: params.get('metric'),
  };

  const update = (patch: Record<string, string | null>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  useEffect(() => setVisible(PAGE), [params]);

  const matches = (e: Experiment, skip?: FilterKey) => {
    if (line && e.researchLineId !== line.id) return false;
    if (skip !== 'dataset' && f.dataset && data.datasets.get(e.datasetId ?? -1)?.slug !== f.dataset) return false;
    if (skip !== 'factor' && f.factor && e.factor !== f.factor) return false;
    if (skip !== 'model' && f.model && e.modelName !== f.model) return false;
    if (skip !== 'metric' && f.metric && !e.metrics.some((m) => m.metricName === f.metric)) return false;
    return true;
  };

  const filtered = useMemo(() => data.experiments.filter((e) => matches(e)), [data.experiments, params]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contextual options: each list only offers values that exist given the other filters.
  const options = useMemo(() => {
    const count = (key: FilterKey, pick: (e: Experiment) => string[]) => {
      const c = new Map<string, number>();
      for (const e of data.experiments) if (matches(e, key)) for (const v of new Set(pick(e))) c.set(v, (c.get(v) ?? 0) + 1);
      return c;
    };
    const ds = count('dataset', (e) => (e.datasetId != null ? [data.datasets.get(e.datasetId)!.slug] : []));
    const fac = count('factor', (e) => [e.factor]);
    const mod = count('model', (e) => [e.modelName]);
    const met = count('metric', (e) => e.metrics.map((m) => m.metricName));
    const result: Record<FilterKey, FilterOption[]> = {
      dataset: data.catalog.datasets
        .filter((d) => ds.has(d.slug))
        .map((d) => ({ value: d.slug, label: d.shortName, count: ds.get(d.slug) })),
      factor: [...fac.keys()].map((k) => ({ value: k, label: FACTOR_LABELS[k as Factor] ?? k, count: fac.get(k) })),
      model: [...mod.keys()]
        .sort((a, b) => modelRank(a) - modelRank(b) || a.localeCompare(b))
        .map((k) => ({ value: k, label: k, count: mod.get(k) })),
      metric: [...met.keys()].map((k) => ({ value: k, label: metricDefinition(k).label, count: met.get(k) })),
    };
    return result;
  }, [data, params]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heatmap: one protocol-compatible comparison set at a time.
  const setOptions = data.catalog.comparisonSets.filter((s) => !line || s.researchLineId === line.id);
  const requestedSet = params.get('set') ? data.setBySlug.get(params.get('set')!) : undefined;
  const set =
    (requestedSet && setOptions.includes(requestedSet) ? requestedSet : undefined) ??
    (f.factor ? setOptions.find((s) => s.factor === f.factor) : undefined) ??
    setOptions[0];
  const setExperiments = useMemo(
    () => (set ? set.experimentIds.map((id) => data.experimentsById.get(id)).filter((e): e is Experiment => !!e) : []),
    [set, data.experimentsById],
  );
  const measures = useMemo(() => measuresFor(setExperiments), [setExperiments]);
  const measure =
    measures.find((m) => m.key === params.get('measure')) ??
    (f.metric ? measures.find((m) => m.metricName === f.metric) : undefined) ??
    defaultMeasure(measures);

  const [selection, setSelection] = useState<HeatmapSelection | null>(null);
  useEffect(() => setSelection(null), [set?.id]);
  const selectedExp = selection ? data.experimentsById.get(selection.experimentId) : undefined;
  const protocol = set ? data.protocols.get(set.protocolId) : undefined;

  const figures = useAsync((signal) => api.get<Figure[]>('/figures', signal), []);
  const lineFigures =
    figures.state.status === 'ready'
      ? figures.state.data.filter((fig) => !line || fig.researchLineId === line.id)
      : [];

  const activeCount = FILTER_KEYS.filter((k) => f[k]).length;

  return (
    <div>
      <PageHeader
        eyebrow="Explore"
        title="Experimental results"
        description="Both lines of evidence in one place. Filter by line, dataset, factor, model and metric; numbers are published means unless stated otherwise."
      />

      <FilterPanel
        activeCount={activeCount}
        onClear={() => update({ dataset: null, factor: null, model: null, metric: null })}
        lead={
          <Segmented
            type="single"
            value={line?.slug ?? 'all'}
            aria-label="Research line"
            className="rounded-2xl sm:rounded-full"
            onValueChange={(v) => v && update({ line: v === 'all' ? null : v, set: null, measure: null, dataset: null, model: null, factor: null })}
          >
            <SegmentedItem value="all">All lines</SegmentedItem>
            {data.catalog.researchLines.map((l) => (
              <SegmentedItem key={l.slug} value={l.slug}>
                <span className="hidden sm:inline">Line {l.code} ·</span> {l.name}
              </SegmentedItem>
            ))}
          </Segmented>
        }
      >
        <FilterSelect label="Dataset" value={f.dataset} options={options.dataset} onChange={(v) => update({ dataset: v })} />
        <FilterSelect label="Experimental factor" value={f.factor} options={options.factor} onChange={(v) => update({ factor: v, set: null })} />
        <FilterSelect label="Model" value={f.model} options={options.model} onChange={(v) => update({ model: v })} />
        <FilterSelect label="Metric" value={f.metric} options={options.metric} onChange={(v) => update({ metric: v, measure: null })} />
      </FilterPanel>

      {/* Heatmap */}
      <section className="mt-10" aria-labelledby="heatmap-title">
        <SectionHeader
          id="heatmap-title"
          icon={<Grid3x3 />}
          title="Metric heatmap"
          description="One comparison set at a time: every cell in a set shares the same protocol, so colors are comparable within the map."
        />
        <Panel className="p-4 sm:p-6">
          {set && measure ? (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex min-w-0 flex-col gap-1.5 lg:max-w-md lg:flex-1">
                  <span id="set-label" className="px-1 text-[0.72rem] font-semibold text-ink-3">
                    Experiment / configuration
                  </span>
                  <Select value={set.slug} onValueChange={(v) => update({ set: v, measure: null })}>
                    <SelectTrigger aria-labelledby="set-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {setOptions.map((s) => (
                        <SelectItem key={s.slug} value={s.slug}>
                          {line ? '' : `${data.lines.get(s.researchLineId)?.code} · `}
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="px-1 text-[0.72rem] font-semibold text-ink-3">Metric</span>
                  <Segmented
                    type="single"
                    value={measure.key}
                    aria-label="Heatmap metric"
                    onValueChange={(v) => v && update({ measure: v })}
                  >
                    {measures
                      .filter((m) => !m.metricName.startsWith('param_count') && m.metricName !== 'geometry_ratio')
                      .map((m) => (
                        <SegmentedItem key={m.key} value={m.key}>
                          {measureLabel(m, { short: true })}
                        </SegmentedItem>
                      ))}
                  </Segmented>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-2">
                {set.description}{' '}
                {protocol && <span className="text-ink-3">Protocol: {protocol.evaluation}.</span>}
              </p>
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0">
                  <MetricHeatmap
                    experiments={setExperiments}
                    measure={measure}
                    measures={measures.filter((m) => !m.metricName.startsWith('param_count') && m.metricName !== 'geometry_ratio')}
                    selection={selection}
                    onSelect={setSelection}
                    rowLabel={set.rowLabel}
                  />
                </div>
                <CellContext experiment={selectedExp} measureKey={selection?.measureKey} />
              </div>
            </>
          ) : (
            <EmptyState title="No comparison set for this selection" description="Try another research line." />
          )}
        </Panel>
      </section>

      {/* Experiment list */}
      <section className="mt-12" aria-labelledby="list-title">
        <SectionHeader
          id="list-title"
          icon={<ListFilter />}
          title="Experiments"
          description={
            <span className="tabular">
              {filtered.length} of {data.experiments.length} published results match the current filters.
            </span>
          }
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="No experiments match these filters"
            description="Remove a filter to widen the selection."
            action={
              <Button variant="outline" size="sm" onClick={() => update({ dataset: null, factor: null, model: null, metric: null })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.slice(0, visible).map((e) => (
                <li key={e.id}>
                  <ExperimentCard experiment={e} />
                </li>
              ))}
            </ul>
            {visible < filtered.length && (
              <div className="mt-6 flex justify-center">
                <Button variant="glass" onClick={() => setVisible((v) => v + PAGE)}>
                  Show more <span className="tabular text-ink-3">({filtered.length - visible} left)</span>
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Figures */}
      <section className="mt-12" aria-labelledby="figures-title">
        <SectionHeader
          id="figures-title"
          icon={<Images />}
          title="Figures"
          description="Original figures from the manuscripts and images added by the researchers. They complement the interactive charts."
        />
        {figures.state.status === 'loading' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/3]" />
            ))}
          </div>
        ) : lineFigures.length === 0 ? (
          <EmptyState compact title="No figures for this selection" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {lineFigures.map((fig) => (
              <li key={fig.id}>
                <FigureViewer figure={fig} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
