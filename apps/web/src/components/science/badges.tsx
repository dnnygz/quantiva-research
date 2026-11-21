import { AGREEMENT_LABELS, FACTOR_LABELS, type Agreement, type Factor, type ResearchLine } from '@qa/shared';
import { Badge } from '@/components/ui/badge';
import { modelColor } from '@/lib/colors';
import { cn } from '@/lib/utils';

/** Line A = sky, Line B = lavender; consistent everywhere. */
export function lineTone(code: string) {
  return code === 'A' ? 'sky' : code === 'B' ? 'lavender' : 'mint';
}

export function LineBadge({ line, compact }: { line: ResearchLine; compact?: boolean }) {
  return (
    <Badge variant={lineTone(line.code)} className={cn(compact && 'h-5 shrink-0 px-2 text-[0.68rem]')} title={line.name}>
      {compact ? `Line ${line.code}` : `Line ${line.code} · ${line.name}`}
    </Badge>
  );
}

export function FactorBadge({ factor }: { factor: Factor }) {
  return <Badge variant="muted">{FACTOR_LABELS[factor] ?? factor}</Badge>;
}

const AGREEMENT_TONE: Record<Agreement, 'mint' | 'amber' | 'muted'> = {
  converging: 'mint',
  mixed: 'amber',
  open: 'muted',
};
const AGREEMENT_GLYPH: Record<Agreement, string> = { converging: '⇉', mixed: '⇄', open: '?' };

export function AgreementBadge({ agreement }: { agreement: Agreement }) {
  return (
    <Badge variant={AGREEMENT_TONE[agreement]} className="shrink-0">
      <span aria-hidden>{AGREEMENT_GLYPH[agreement]}</span>
      {AGREEMENT_LABELS[agreement]}
    </Badge>
  );
}

export function ModelDot({ model, className }: { model: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-full ring-2 ring-white', className)}
      style={{ background: modelColor(model) }}
    />
  );
}

export function StatusBadge({ status }: { status: 'draft' | 'published' }) {
  return status === 'published' ? (
    <Badge variant="mint">● Published</Badge>
  ) : (
    <Badge variant="amber">○ Draft</Badge>
  );
}
