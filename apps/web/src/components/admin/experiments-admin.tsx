import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  AGGREGATIONS,
  AGGREGATION_LABELS,
  FACTORS,
  FACTOR_LABELS,
  METRIC_DEFINITIONS,
  MODEL_FAMILIES,
  SPLITS,
  SPLIT_LABELS,
  type Experiment,
  type ExperimentDetail,
  type Metric,
  type MetricInput,
} from '@qa/shared';
import { Panel } from '@/components/aero/glass-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { ModelDot, StatusBadge } from '@/components/science/badges';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/use-async';
import { useResearch } from '@/hooks/research-data';
import { api } from '@/lib/api';
import { formatPublished } from '@/lib/format';

type DetailWithSets = ExperimentDetail & { comparisonSetIds: number[] };

export function ExperimentsAdmin({ onChanged }: { onChanged: () => void }) {
  const { lines, datasets } = useResearch();
  const { state, reload } = useAsync((signal) => api.get<Experiment[]>('/admin/experiments', signal), []);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  const list = useMemo(() => {
    if (state.status !== 'ready') return [];
    const q = query.trim().toLowerCase();
    return q
      ? state.data.filter((e) => `${e.title} ${e.slug} ${e.modelName} ${e.variant ?? ''}`.toLowerCase().includes(q))
      : state.data;
  }, [state, query]);

  const changed = () => {
    reload();
    onChanged();
  };

  return (
    <Panel className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            aria-label="Search experiments"
            placeholder="Search title, slug or model…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="aero" onClick={() => setEditing('new')}>
          <Plus /> New experiment
        </Button>
      </div>

      {state.status === 'loading' && <Skeleton className="mt-4 h-64" />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={reload} />}
      {state.status === 'ready' &&
        (list.length === 0 ? (
          <EmptyState className="mt-4" compact title="No experiments match" />
        ) : (
          <div className="scrollbar-thin mt-4 max-h-[60dvh] overflow-auto rounded-2xl ring-1 ring-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 z-10 bg-[#f3f9fd] text-left text-xs text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Line</th>
                  <th className="px-3 py-2 font-semibold">Dataset</th>
                  <th className="px-3 py-2 font-semibold">Metrics</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-t border-line/70 hover:bg-[#f7fbfe]">
                    <td className="px-3 py-2">
                      <p className="flex items-center gap-2 font-semibold">
                        <ModelDot model={e.modelName} />
                        <span className="line-clamp-1">{e.title}</span>
                      </p>
                      <p className="pl-4.5 text-xs text-ink-3">{e.slug}</p>
                    </td>
                    <td className="px-3 py-2 text-ink-2">{lines.get(e.researchLineId)?.code}</td>
                    <td className="px-3 py-2 text-ink-2">{e.datasetId != null ? datasets.get(e.datasetId)?.shortName : '—'}</td>
                    <td className="tabular px-3 py-2 text-ink-2">{e.metrics.length}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(e.id)} aria-label={`Edit ${e.title}`}>
                        <Pencil /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent side="right" className="max-w-2xl">
          {editing === 'new' ? (
            <ExperimentEditor key="new" onSaved={(id) => (changed(), setEditing(id))} onDeleted={() => (changed(), setEditing(null))} />
          ) : editing !== null ? (
            <ExperimentLoader key={editing} id={editing} onChanged={changed} onDeleted={() => (changed(), setEditing(null))} />
          ) : null}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function ExperimentLoader({ id, onChanged, onDeleted }: { id: number; onChanged: () => void; onDeleted: () => void }) {
  const { state, reload } = useAsync((signal) => api.get<DetailWithSets>(`/admin/experiments/${id}`, signal), [id]);
  if (state.status === 'loading') return <Skeleton className="h-96" />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={reload} />;
  return (
    <ExperimentEditor
      experiment={state.data}
      onSaved={() => (reload(), onChanged())}
      onDeleted={onDeleted}
    />
  );
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

function numOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? '').trim();
  return s === '' ? null : Number(s);
}
function strOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

function ExperimentEditor({
  experiment,
  onSaved,
  onDeleted,
}: {
  experiment?: DetailWithSets;
  onSaved: (id: number) => void;
  onDeleted: () => void;
}) {
  const { catalog } = useResearch();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lineId, setLineId] = useState(experiment?.researchLineId ?? catalog.researchLines[0]!.id);
  const [newMetrics, setNewMetrics] = useState<MetricInput[]>([]);
  const isNew = !experiment;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    let configuration: Record<string, unknown> | null = null;
    const rawConfig = String(f.get('configuration') ?? '').trim();
    if (rawConfig) {
      try {
        configuration = JSON.parse(rawConfig) as Record<string, unknown>;
      } catch {
        setError('Configuration must be valid JSON (or empty).');
        return;
      }
    }
    const title = String(f.get('title')).trim();
    const body = {
      slug: strOrNull(f.get('slug')) ?? slugify(title),
      researchLineId: Number(f.get('researchLineId')),
      protocolId: Number(f.get('protocolId')),
      datasetId: numOrNull(f.get('datasetId')),
      title,
      modelName: String(f.get('modelName')).trim(),
      modelFamily: String(f.get('modelFamily')),
      variant: strOrNull(f.get('variant')),
      setting: strOrNull(f.get('setting')),
      factor: String(f.get('factor')),
      objective: String(f.get('objective') ?? ''),
      description: String(f.get('description') ?? ''),
      configuration,
      fold: numOrNull(f.get('fold')),
      seed: numOrNull(f.get('seed')),
      nSeeds: numOrNull(f.get('nSeeds')),
      nFolds: numOrNull(f.get('nFolds')),
      observations: strOrNull(f.get('observations')),
      limitations: strOrNull(f.get('limitations')),
      source: String(f.get('source')).trim(),
      status: String(f.get('status')),
      comparisonSetIds: f.getAll('comparisonSetIds').map(Number),
    };
    setBusy(true);
    setError(null);
    try {
      const saved = isNew
        ? await api.post<DetailWithSets>('/admin/experiments', { ...body, metrics: newMetrics })
        : await api.patch<DetailWithSets>(`/admin/experiments/${experiment.id}`, body);
      onSaved(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!experiment || !window.confirm(`Delete “${experiment.title}” and its metrics? This cannot be undone.`)) return;
    await api.del(`/admin/experiments/${experiment.id}`);
    onDeleted();
  }

  const protocols = catalog.protocols.filter((p) => p.researchLineId === lineId);
  const sets = catalog.comparisonSets.filter((s) => s.researchLineId === lineId);

  return (
    <div>
      <DialogTitle>{isNew ? 'New experiment' : 'Edit experiment'}</DialogTitle>
      <DialogDescription>
        Results are entered explicitly. Record whether a value is a single run or an aggregate (mean over seeds or folds).
      </DialogDescription>

      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <Input name="title" required defaultValue={experiment?.title} placeholder="e.g. VQC with re-uploading on WDBC" />
        </Field>
        <Field label="Slug (URL id)" hint={isNew ? 'Leave empty to derive from the title.' : undefined}>
          <Input name="slug" defaultValue={experiment?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        </Field>
        <Field label="Status">
          <NativeSelect name="status" defaultValue={experiment?.status ?? 'draft'}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </NativeSelect>
        </Field>
        <Field label="Research line">
          <NativeSelect name="researchLineId" value={lineId} onChange={(e) => setLineId(Number(e.target.value))}>
            {catalog.researchLines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Protocol">
          <NativeSelect name="protocolId" defaultValue={experiment?.protocolId} key={`p-${lineId}`}>
            {protocols.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Dataset">
          <NativeSelect name="datasetId" defaultValue={experiment?.datasetId ?? ''}>
            <option value="">— Multiple / not applicable</option>
            {catalog.datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Experimental factor">
          <NativeSelect name="factor" defaultValue={experiment?.factor ?? 'baseline'}>
            {FACTORS.map((f) => (
              <option key={f} value={f}>
                {FACTOR_LABELS[f]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Model">
          <Input name="modelName" required defaultValue={experiment?.modelName} placeholder="VQC, LR, SVM, RF, XGBoost, MLP…" />
        </Field>
        <Field label="Model family">
          <NativeSelect name="modelFamily" defaultValue={experiment?.modelFamily ?? 'quantum'}>
            {MODEL_FAMILIES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Variant" hint="Shown next to the model, e.g. “4 layers”.">
          <Input name="variant" defaultValue={experiment?.variant ?? ''} />
        </Field>
        <Field label="Setting" hint="Row label when the dataset is not enough (task, fold).">
          <Input name="setting" defaultValue={experiment?.setting ?? ''} />
        </Field>
        <Field label="Objective" className="sm:col-span-2">
          <Textarea name="objective" rows={2} defaultValue={experiment?.objective} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea name="description" rows={3} defaultValue={experiment?.description} />
        </Field>
        <div className="grid grid-cols-4 gap-3 sm:col-span-2">
          <Field label="Seeds (n)">
            <Input name="nSeeds" type="number" min={1} defaultValue={experiment?.nSeeds ?? ''} />
          </Field>
          <Field label="Folds (n)">
            <Input name="nFolds" type="number" min={1} defaultValue={experiment?.nFolds ?? ''} />
          </Field>
          <Field label="Fold">
            <Input name="fold" type="number" min={0} defaultValue={experiment?.fold ?? ''} />
          </Field>
          <Field label="Seed">
            <Input name="seed" type="number" min={0} defaultValue={experiment?.seed ?? ''} />
          </Field>
        </div>
        <Field label="Configuration (JSON, optional)" className="sm:col-span-2">
          <Textarea
            name="configuration"
            rows={3}
            className="font-mono text-xs"
            defaultValue={experiment?.configuration ? JSON.stringify(experiment.configuration, null, 2) : ''}
            placeholder='{"layers": 2, "epochs": 200}'
          />
        </Field>
        <Field label="Observations" className="sm:col-span-2">
          <Textarea name="observations" rows={2} defaultValue={experiment?.observations ?? ''} />
        </Field>
        <Field label="Limitations / notes" className="sm:col-span-2">
          <Textarea name="limitations" rows={2} defaultValue={experiment?.limitations ?? ''} />
        </Field>
        <Field label="Source" className="sm:col-span-2" hint="Where the numbers were published, e.g. “Manuscript A, Table III”.">
          <Input name="source" required defaultValue={experiment?.source} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-[0.8rem] font-semibold text-ink-2">Comparison sets (protocol-compatible groups)</legend>
          <div className="mt-2 flex flex-wrap gap-2" key={`s-${lineId}`}>
            {sets.map((s) => (
              <label key={s.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium has-[:checked]:bg-primary-50 has-[:checked]:text-primary-700 has-[:checked]:ring-1 has-[:checked]:ring-primary-600/30">
                <input type="checkbox" name="comparisonSetIds" value={s.id} defaultChecked={experiment?.comparisonSetIds.includes(s.id)} className="accent-[#0a7396]" />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>

        {isNew && (
          <div className="sm:col-span-2">
            <p className="text-[0.8rem] font-semibold text-ink-2">Metrics</p>
            <MetricRowsInput rows={newMetrics} onChange={setNewMetrics} />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-[#fff1ea] px-3 py-2 text-sm text-[#9a3412] sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          {!isNew ? (
            <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>
              <Trash2 /> Delete
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" variant="aero" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Create experiment' : 'Save changes'}
          </Button>
        </div>
      </form>

      {experiment && (
        <>
          <MetricEditor experiment={experiment} onChanged={() => onSaved(experiment.id)} />
          <HistoryEditor experiment={experiment} onChanged={() => onSaved(experiment.id)} />
        </>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <span className="text-[0.8rem] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

const blankMetric = (): MetricInput => ({
  metricName: 'roc_auc',
  value: Number.NaN,
  split: 'validation',
  aggregation: 'mean_over_folds_and_seeds',
  unit: null,
  source: null,
});

/** Metric rows for a new experiment (sent together with it). */
function MetricRowsInput({ rows, onChange }: { rows: MetricInput[]; onChange: (r: MetricInput[]) => void }) {
  return (
    <div className="mt-2 space-y-2">
      {rows.map((r, i) => (
        <MetricRow
          key={i}
          value={r}
          onChange={(nr) => onChange(rows.map((x, j) => (j === i ? nr : x)))}
          onRemove={() => onChange(rows.filter((_, j) => j !== i))}
        />
      ))}
      <Button type="button" variant="subtle" size="sm" onClick={() => onChange([...rows, blankMetric()])}>
        <Plus /> Add metric
      </Button>
    </div>
  );
}

function MetricRow({
  value,
  onChange,
  onRemove,
  onSave,
}: {
  value: MetricInput;
  onChange: (m: MetricInput) => void;
  onRemove: () => void;
  onSave?: () => void;
}) {
  const known = Object.keys(METRIC_DEFINITIONS);
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-2.5 sm:grid-cols-[1.3fr_1fr_1.4fr_0.9fr_auto]">
      <Input
        aria-label="Metric key"
        list="metric-keys"
        value={value.metricName}
        onChange={(e) => onChange({ ...value, metricName: e.target.value.trim() })}
        className="h-9"
      />
      <datalist id="metric-keys">
        {known.map((k) => (
          <option key={k} value={k}>
            {METRIC_DEFINITIONS[k as keyof typeof METRIC_DEFINITIONS].label}
          </option>
        ))}
      </datalist>
      <NativeSelect aria-label="Split" className="h-9" value={value.split ?? ''} onChange={(e) => onChange({ ...value, split: (e.target.value || null) as MetricInput['split'] })}>
        <option value="">— no split</option>
        {SPLITS.map((s) => (
          <option key={s} value={s}>
            {SPLIT_LABELS[s]}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label="Aggregation" className="h-9" value={value.aggregation ?? ''} onChange={(e) => onChange({ ...value, aggregation: (e.target.value || null) as MetricInput['aggregation'] })}>
        <option value="">— unspecified</option>
        {AGGREGATIONS.map((a) => (
          <option key={a} value={a}>
            {AGGREGATION_LABELS[a]}
          </option>
        ))}
      </NativeSelect>
      <Input
        aria-label="Value"
        type="number"
        step="any"
        required
        className="tabular h-9"
        value={Number.isNaN(value.value) ? '' : value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
      />
      <div className="flex gap-1">
        {onSave && (
          <Button type="button" size="sm" variant="subtle" onClick={onSave}>
            Save
          </Button>
        )}
        <Button type="button" size="icon" variant="ghost" aria-label="Remove metric" onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

function MetricEditor({ experiment, onChanged }: { experiment: DetailWithSets; onChanged: () => void }) {
  const [draft, setDraft] = useState<MetricInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(p: Promise<unknown>) {
    setError(null);
    try {
      await p;
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    }
  }

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h3 className="text-base font-bold">Metrics</h3>
      <p className="text-xs text-ink-3">Values are stored as numbers. Do not attach values published for another configuration.</p>
      <ul className="mt-3 divide-y divide-line rounded-2xl ring-1 ring-line">
        {experiment.metrics.length === 0 && <li className="px-3 py-3 text-sm text-ink-3">No metrics yet.</li>}
        {experiment.metrics.map((m: Metric) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>
              <span className="font-semibold">{m.metricName}</span>
              <span className="text-ink-3">
                {' '}
                · {m.split ? SPLIT_LABELS[m.split] : 'no split'} · {m.aggregation ? AGGREGATION_LABELS[m.aggregation] : 'unspecified'}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular font-semibold">{formatPublished(m.value)}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${m.metricName}`}
                onClick={() => window.confirm('Delete this metric?') && run(api.del(`/admin/metrics/${m.id}`))}
              >
                <Trash2 />
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {draft ? (
        <div className="mt-3">
          <MetricRow
            value={draft}
            onChange={setDraft}
            onRemove={() => setDraft(null)}
            onSave={() => {
              if (Number.isNaN(draft.value)) return setError('Enter a numeric value.');
              void run(api.post('/admin/metrics', { ...draft, experimentId: experiment.id })).then(() => setDraft(null));
            }}
          />
        </div>
      ) : (
        <Button className="mt-3" variant="subtle" size="sm" onClick={() => setDraft(blankMetric())}>
          <Plus /> Add metric
        </Button>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-[#9a3412]">{error}</p>}
    </section>
  );
}

/** Per-epoch losses. Only real recorded history — paste CSV rows "epoch,train_loss,val_loss". */
function HistoryEditor({ experiment, onChanged }: { experiment: DetailWithSets; onChanged: () => void }) {
  const initial = experiment.trainingHistory.map((p) => `${p.epoch},${p.trainLoss ?? ''},${p.valLoss ?? ''}`).join('\n');
  const [text, setText] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    const points = [];
    for (const [i, line] of text.split('\n').entries()) {
      if (!line.trim() || /^epoch/i.test(line.trim())) continue;
      const [ep, tr, va] = line.split(/[,;\t]/).map((s) => s.trim());
      const epoch = Number(ep);
      const trainLoss = tr ? Number(tr) : null;
      const valLoss = va ? Number(va) : null;
      if (!Number.isInteger(epoch) || Number.isNaN(trainLoss) || Number.isNaN(valLoss)) {
        setMsg(`Line ${i + 1} is not valid.`);
        return;
      }
      points.push({ epoch, trainLoss, valLoss });
    }
    try {
      await api.put(`/admin/experiments/${experiment.id}/history`, { points });
      setMsg(`Saved ${points.length} epochs.`);
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    }
  }

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h3 className="text-base font-bold">Training history (optional)</h3>
      <p className="text-xs text-ink-3">
        Only real per-epoch values from the training logs. One row per epoch: <code>epoch,train_loss,val_loss</code>. Leave
        empty and save to remove the curve.
      </p>
      <Textarea className="mt-3 font-mono text-xs" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'1,0.693,0.701\n2,0.612,0.640'} />
      <div className="mt-2 flex items-center gap-3">
        <Button variant="subtle" size="sm" onClick={save}>
          Save history
        </Button>
        {msg && <span className="text-xs text-ink-2">{msg}</span>}
      </div>
    </section>
  );
}
