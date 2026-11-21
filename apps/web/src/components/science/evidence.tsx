import { Link } from 'react-router';
import { CircleHelp, Lightbulb, ShieldAlert } from 'lucide-react';
import type { Finding, ResearchLine, ResearchQuestion } from '@qa/shared';
import { AgreementBadge, LineBadge, ModelDot } from '@/components/science/badges';
import { useResearch } from '@/hooks/research-data';
import { columnKey } from '@/lib/measures';
import { cn } from '@/lib/utils';

/** One researcher-curated finding: observation, interpretation, limits, evidence links. */
export function ScientificFindingCard({ finding }: { finding: Finding }) {
  const { experimentsById, datasets } = useResearch();
  const exps = finding.experimentIds.map((id) => experimentsById.get(id)).filter((e) => !!e);
  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
      <p className="text-[0.92rem] leading-relaxed text-ink">{finding.observation}</p>
      {finding.interpretation && (
        <p className="mt-3 flex gap-2 text-sm leading-relaxed text-ink-2">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#5d7d12]" aria-hidden />
          <span>
            <span className="sr-only">Interpretation: </span>
            {finding.interpretation}
          </span>
        </p>
      )}
      {finding.limitations && (
        <p className="mt-2 flex gap-2 text-sm leading-relaxed text-ink-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#b45309]" aria-hidden />
          <span>
            <span className="sr-only">Limitations: </span>
            {finding.limitations}
          </span>
        </p>
      )}
      {exps.length > 0 && (
        <div className="mt-auto pt-4">
          <p className="eyebrow mb-1.5">Supporting experiments ({exps.length})</p>
          <ul className="flex flex-wrap gap-1.5">
            {exps.slice(0, 8).map((e) => (
              <li key={e!.id}>
                <Link
                  to={`/experiments/${e!.slug}`}
                  title={e!.title}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-primary-50 hover:text-ink"
                >
                  <ModelDot model={e!.modelName} />
                  {columnKey(e!)}
                  <span className="text-ink-3">· {e!.setting ?? (e!.datasetId != null ? datasets.get(e!.datasetId)?.shortName : 'all')}</span>
                </Link>
              </li>
            ))}
            {exps.length > 8 && <li className="px-1 py-1 text-xs text-ink-3">+{exps.length - 8} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function LineColumn({ line, findings }: { line: ResearchLine; findings: Finding[] }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-3xl p-3 sm:p-4', line.code === 'A' ? 'bg-[#eaf6fe]/70' : 'bg-[#f1edff]/70')}>
      <LineBadge line={line} />
      {findings.length ? (
        findings.map((f) => <ScientificFindingCard key={f.id} finding={f} />)
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line-strong bg-white/50 p-6 text-center text-sm text-ink-3">
          No direct evidence in this line.
        </div>
      )}
    </div>
  );
}

/** A research question with the findings of each line side by side. */
export function EvidenceComparison({ question }: { question: ResearchQuestion }) {
  const { catalog } = useResearch();
  const crossLine = question.findings.filter((f) => f.researchLineId === null);
  return (
    <article id={question.slug} className="glass scroll-mt-28 rounded-3xl p-4 sm:p-6" aria-labelledby={`${question.slug}-title`}>
      <header className="flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id={`${question.slug}-title`} className="text-xl leading-snug font-bold">
            {question.question}
          </h3>
          {question.context && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-2">{question.context}</p>}
        </div>
        <AgreementBadge agreement={question.agreement} />
      </header>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {catalog.researchLines.map((l) => (
          <LineColumn key={l.id} line={l} findings={question.findings.filter((f) => f.researchLineId === l.id)} />
        ))}
      </div>
      {crossLine.length > 0 && (
        <div className="mt-4 grid gap-3">
          {crossLine.map((f) => (
            <ScientificFindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}
      {question.openQuestions && (
        <p className="mt-4 flex gap-2 rounded-2xl bg-white/70 px-4 py-3 text-sm leading-relaxed text-ink-2 ring-1 ring-white">
          <CircleHelp className="mt-0.5 size-4 shrink-0 text-lavender-700" aria-hidden />
          <span>
            <span className="font-semibold text-ink">Still open: </span>
            {question.openQuestions}
          </span>
        </p>
      )}
    </article>
  );
}
