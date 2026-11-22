import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  AGREEMENT,
  AGREEMENT_LABELS,
  type Experiment,
  type Finding,
  type ResearchQuestion,
} from '@qa/shared';
import { Panel } from '@/components/aero/glass-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { AgreementBadge, StatusBadge } from '@/components/science/badges';
import { ErrorState } from '@/components/feedback/states';
import { Skeleton } from '@/components/ui/skeleton';
import { Field } from '@/components/admin/experiments-admin';
import { useAsync } from '@/hooks/use-async';
import { useResearch } from '@/hooks/research-data';
import { api } from '@/lib/api';

type Editing =
  | { kind: 'question'; question?: ResearchQuestion }
  | { kind: 'finding'; question: ResearchQuestion; finding?: Finding }
  | null;

export function FindingsAdmin({ onChanged }: { onChanged: () => void }) {
  const { lines } = useResearch();
  const { state, reload } = useAsync(
    async (signal) => {
      const [questions, experiments] = await Promise.all([
        api.get<ResearchQuestion[]>('/admin/questions', signal),
        api.get<Experiment[]>('/admin/experiments', signal),
      ]);
      return { questions, experiments };
    },
    [],
  );
  const [editing, setEditing] = useState<Editing>(null);
  const done = () => {
    setEditing(null);
    reload();
    onChanged();
  };

  if (state.status === 'loading') return <Skeleton className="h-80" />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={reload} />;
  const { questions, experiments } = state.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-ink-2">
          Findings feed the cross-line evidence synthesis. They are written and reviewed by the researchers; nothing is generated
          automatically.
        </p>
        <Button variant="aero" onClick={() => setEditing({ kind: 'question' })}>
          <Plus /> New research question
        </Button>
      </div>

      {questions.map((q) => (
        <Panel key={q.id} className="p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-bold">{q.question}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <AgreementBadge agreement={q.agreement} />
                <StatusBadge status={q.status} />
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing({ kind: 'question', question: q })}>
                <Pencil /> Edit
              </Button>
              <Button variant="subtle" size="sm" onClick={() => setEditing({ kind: 'finding', question: q })}>
                <Plus /> Finding
              </Button>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {q.findings.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 rounded-2xl bg-muted/60 p-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-3">
                    {f.researchLineId != null ? `Line ${lines.get(f.researchLineId)?.code}` : 'Cross-line'} ·{' '}
                    {f.experimentIds.length} experiments · {f.status}
                  </p>
                  <p className="mt-1 line-clamp-2 text-ink-2">{f.observation}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Edit finding" onClick={() => setEditing({ kind: 'finding', question: q, finding: f })}>
                  <Pencil />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      ))}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent side="right" className="max-w-2xl">
          {editing?.kind === 'question' && <QuestionForm question={editing.question} onDone={done} />}
          {editing?.kind === 'finding' && (
            <FindingForm question={editing.question} finding={editing.finding} experiments={experiments} onDone={done} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useSubmit() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, after: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

function QuestionForm({ question, onDone }: { question?: ResearchQuestion; onDone: () => void }) {
  const { error, busy, run } = useSubmit();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = String(f.get('question')).trim();
    const body = {
      slug:
        String(f.get('slug') ?? '').trim() ||
        text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80),
      question: text,
      context: String(f.get('context') ?? ''),
      agreement: String(f.get('agreement')),
      openQuestions: String(f.get('openQuestions') ?? ''),
      status: String(f.get('status')),
      sortOrder: Number(f.get('sortOrder') || 0),
    };
    void run(() => (question ? api.patch(`/admin/questions/${question.id}`, body) : api.post('/admin/questions', body)), onDone);
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <DialogTitle>{question ? 'Edit research question' : 'New research question'}</DialogTitle>
        <DialogDescription>Groups findings from both lines under one question.</DialogDescription>
      </div>
      <Field label="Question" className="sm:col-span-2">
        <Input name="question" required defaultValue={question?.question} />
      </Field>
      <Field label="Slug (anchor)">
        <Input name="slug" defaultValue={question?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
      </Field>
      <Field label="Agreement between lines">
        <NativeSelect name="agreement" defaultValue={question?.agreement ?? 'open'}>
          {AGREEMENT.map((a) => (
            <option key={a} value={a}>
              {AGREEMENT_LABELS[a]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Context" className="sm:col-span-2">
        <Textarea name="context" rows={2} defaultValue={question?.context} />
      </Field>
      <Field label="Still open" className="sm:col-span-2">
        <Textarea name="openQuestions" rows={2} defaultValue={question?.openQuestions} />
      </Field>
      <Field label="Status">
        <NativeSelect name="status" defaultValue={question?.status ?? 'draft'}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </NativeSelect>
      </Field>
      <Field label="Order">
        <Input name="sortOrder" type="number" defaultValue={question?.sortOrder ?? 0} />
      </Field>
      {error && <p role="alert" className="text-sm text-[#9a3412] sm:col-span-2">{error}</p>}
      <div className="flex justify-between sm:col-span-2">
        {question ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => window.confirm('Delete this question and all its findings?') && run(() => api.del(`/admin/questions/${question.id}`), onDone)}
          >
            <Trash2 /> Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="aero" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

function FindingForm({
  question,
  finding,
  experiments,
  onDone,
}: {
  question: ResearchQuestion;
  finding?: Finding;
  experiments: Experiment[];
  onDone: () => void;
}) {
  const { catalog } = useResearch();
  const { error, busy, run } = useSubmit();
  const [selected, setSelected] = useState<Set<number>>(new Set(finding?.experimentIds ?? []));
  const [query, setQuery] = useState('');
  const [lineId, setLineId] = useState<string>(finding?.researchLineId != null ? String(finding.researchLineId) : String(catalog.researchLines[0]!.id));

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return experiments
      .filter((e) => !lineId || e.researchLineId === Number(lineId) || selected.has(e.id))
      .filter((e) => !q || `${e.title} ${e.slug}`.toLowerCase().includes(q))
      .slice(0, 80);
  }, [experiments, query, lineId, selected]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      questionId: question.id,
      researchLineId: lineId ? Number(lineId) : null,
      observation: String(f.get('observation')).trim(),
      interpretation: String(f.get('interpretation') ?? ''),
      limitations: String(f.get('limitations') ?? ''),
      status: String(f.get('status')),
      sortOrder: Number(f.get('sortOrder') || 0),
      experimentIds: [...selected],
    };
    void run(() => (finding ? api.patch(`/admin/findings/${finding.id}`, body) : api.post('/admin/findings', body)), onDone);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <DialogTitle>{finding ? 'Edit finding' : 'New finding'}</DialogTitle>
        <DialogDescription>{question.question}</DialogDescription>
      </div>
      <Field label="Research line">
        <NativeSelect value={lineId} onChange={(e) => setLineId(e.target.value)}>
          {catalog.researchLines.map((l) => (
            <option key={l.id} value={l.id}>
              Line {l.code} · {l.name}
            </option>
          ))}
          <option value="">Cross-line (both)</option>
        </NativeSelect>
      </Field>
      <Field label="Status">
        <NativeSelect name="status" defaultValue={finding?.status ?? 'draft'}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </NativeSelect>
      </Field>
      <Field label="Observation" className="sm:col-span-2" hint="What was measured, with the reported numbers.">
        <Textarea name="observation" rows={4} required defaultValue={finding?.observation} />
      </Field>
      <Field label="Interpretation" className="sm:col-span-2">
        <Textarea name="interpretation" rows={2} defaultValue={finding?.interpretation} />
      </Field>
      <Field label="Limitations" className="sm:col-span-2">
        <Textarea name="limitations" rows={2} defaultValue={finding?.limitations} />
      </Field>
      <Field label="Order">
        <Input name="sortOrder" type="number" defaultValue={finding?.sortOrder ?? 0} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="text-[0.8rem] font-semibold text-ink-2">Supporting experiments ({selected.size})</legend>
        <Input className="mt-2" placeholder="Search experiments…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search experiments" />
        <ul className="scrollbar-thin mt-2 max-h-56 overflow-auto rounded-2xl ring-1 ring-line">
          {candidates.map((e) => (
            <li key={e.id} className="border-b border-line/60 last:border-0">
              <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[#f5fbff]">
                <input
                  type="checkbox"
                  className="accent-[#0a7396]"
                  checked={selected.has(e.id)}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (n.has(e.id)) n.delete(e.id);
                      else n.add(e.id);
                      return n;
                    })
                  }
                />
                <span className="line-clamp-1">{e.title}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {error && <p role="alert" className="text-sm text-[#9a3412] sm:col-span-2">{error}</p>}
      <div className="flex justify-between sm:col-span-2">
        {finding ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => window.confirm('Delete this finding?') && run(() => api.del(`/admin/findings/${finding.id}`), onDone)}>
            <Trash2 /> Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="aero" disabled={busy}>
          {busy ? 'Saving…' : 'Save finding'}
        </Button>
      </div>
    </form>
  );
}
