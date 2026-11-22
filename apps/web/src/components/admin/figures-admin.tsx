import { useState, type FormEvent } from 'react';
import { ImagePlus, Pencil, Trash2, Upload } from 'lucide-react';
import { FIGURE_MAX_BYTES, FIGURE_MIME_TYPES, type Experiment, type Figure } from '@qa/shared';
import { Panel } from '@/components/aero/glass-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Skeleton } from '@/components/ui/skeleton';
import { Field } from '@/components/admin/experiments-admin';
import { useAsync } from '@/hooks/use-async';
import { useResearch } from '@/hooks/research-data';
import { api } from '@/lib/api';

export function FiguresAdmin({ onChanged }: { onChanged: () => void }) {
  const { lines } = useResearch();
  const { state, reload } = useAsync(
    async (signal) => {
      const [figures, experiments] = await Promise.all([
        api.get<Figure[]>('/admin/figures', signal),
        api.get<Experiment[]>('/admin/experiments', signal),
      ]);
      return { figures, experiments };
    },
    [],
  );
  const [editing, setEditing] = useState<Figure | 'new' | null>(null);
  const done = () => {
    setEditing(null);
    reload();
    onChanged();
  };

  if (state.status === 'loading') return <Skeleton className="h-80" />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={reload} />;
  const { figures, experiments } = state.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-2">PNG, JPEG or WebP up to {FIGURE_MAX_BYTES / 1024 / 1024} MB, stored in Cloudflare R2.</p>
        <Button variant="aero" onClick={() => setEditing('new')}>
          <ImagePlus /> Upload figure
        </Button>
      </div>
      {figures.length === 0 ? (
        <EmptyState title="No figures yet" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {figures.map((f) => (
            <li key={f.id}>
              <Panel className="overflow-hidden rounded-2xl">
                <div className="aspect-[4/3] bg-white p-2">
                  <img src={f.url} alt={f.title} loading="lazy" className="h-full w-full object-contain" />
                </div>
                <div className="flex items-start justify-between gap-2 border-t border-line p-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-ink-3">
                      Line {lines.get(f.researchLineId)?.code}
                      {f.experimentId != null && ` · ${experiments.find((e) => e.id === f.experimentId)?.slug ?? ''}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${f.title}`} onClick={() => setEditing(f)}>
                    <Pencil />
                  </Button>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent side="right" className="max-w-xl">
          {editing !== null && (
            <FigureForm key={editing === 'new' ? 'new' : editing.id} figure={editing === 'new' ? undefined : editing} experiments={experiments} onDone={done} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FigureForm({ figure, experiments, onDone }: { figure?: Figure; experiments: Experiment[]; onDone: () => void }) {
  const { catalog } = useResearch();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(figure?.url ?? null);
  const [lineId, setLineId] = useState(figure?.researchLineId ?? catalog.researchLines[0]!.id);

  function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!(FIGURE_MIME_TYPES as readonly string[]).includes(file.type)) return setError('Use a PNG, JPEG or WebP image.');
    if (file.size > FIGURE_MAX_BYTES) return setError('The image is larger than 5 MB.');
    setPreview(URL.createObjectURL(file));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    const hasFile = file instanceof File && file.size > 0;
    if (!figure && !hasFile) return setError('Choose an image to upload.');
    if (!hasFile) form.delete('file');
    form.set('researchLineId', String(lineId));
    setBusy(true);
    setError(null);
    try {
      if (figure) await api.patch(`/admin/figures/${figure.id}`, form);
      else await api.post('/admin/figures', form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!figure || !window.confirm('Delete this figure and its stored image?')) return;
    await api.del(`/admin/figures/${figure.id}`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <DialogTitle>{figure ? 'Edit figure' : 'Upload figure'}</DialogTitle>
        <DialogDescription>Give the figure a clear title and caption, and link it to the experiment it documents.</DialogDescription>
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-line-strong bg-[#f5fbff] p-4 text-center text-sm text-ink-2 hover:bg-white">
        {preview ? (
          <img src={preview} alt="" className="max-h-56 w-auto object-contain" />
        ) : (
          <Upload className="size-6 text-ink-3" />
        )}
        <span>{figure ? 'Choose a file to replace the image (optional)' : 'Choose an image'}</span>
        <input name="file" type="file" accept={FIGURE_MIME_TYPES.join(',')} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <Field label="Title">
        <Input name="title" required defaultValue={figure?.title} />
      </Field>
      <Field label="Description / caption">
        <Textarea name="description" rows={3} defaultValue={figure?.description} />
      </Field>
      <Field label="Source" hint="e.g. Repository, TCGA case study, Fig. 2">
        <Input name="source" defaultValue={figure?.source ?? ''} />
      </Field>
      <Field label="Research line">
        <NativeSelect value={lineId} onChange={(e) => setLineId(Number(e.target.value))}>
          {catalog.researchLines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} · {l.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Experiment">
        <NativeSelect name="experimentId" defaultValue={figure?.experimentId ?? ''}>
          <option value="">— Not linked to a single experiment</option>
          {experiments
            .filter((e) => e.researchLineId === lineId)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
        </NativeSelect>
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-[#fff1ea] px-3 py-2 text-sm text-[#9a3412]">
          {error}
        </p>
      )}
      <div className="flex justify-between">
        {figure ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 /> Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="aero" disabled={busy}>
          {busy ? 'Saving…' : figure ? 'Save' : 'Upload'}
        </Button>
      </div>
    </form>
  );
}
