import type { ReactNode } from 'react';
import { AlertTriangle, CircleDashed, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  compact,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-white/50 text-center',
        compact ? 'gap-1.5 px-4 py-6' : 'gap-2 px-6 py-12',
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-white text-ink-3 shadow-soft [&_svg]:size-5">
        {icon ?? <CircleDashed />}
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-md text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto my-16 max-w-md rounded-3xl border border-[#f6d5c5] bg-white/90 p-6 text-center shadow-soft">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#fff1ea] text-[#b4441b]">
        <AlertTriangle className="size-5" />
      </span>
      <p className="mt-3 font-semibold">The research data could not be loaded</p>
      <p className="mt-1 text-sm text-ink-3">{error.message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCcw /> Try again
        </Button>
      )}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="py-12" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-10 w-2/3 max-w-xl" />
      <Skeleton className="mt-3 h-5 w-1/2 max-w-md" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="mt-6 h-72" />
    </div>
  );
}
