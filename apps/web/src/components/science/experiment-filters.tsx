import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = 'All',
  id,
}: {
  label: string;
  value: string | null;
  options: FilterOption[];
  onChange: (v: string | null) => void;
  allLabel?: string;
  id?: string;
}) {
  const fieldId = id ?? `filter-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={fieldId} className="px-1 text-[0.72rem] font-semibold text-ink-3">
        {label}
      </span>
      <Select value={value ?? '__all'} onValueChange={(v) => onChange(v === '__all' ? null : v)}>
        <SelectTrigger aria-labelledby={fieldId} className={cn(value && 'border-primary-600/50 bg-white')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
              {o.count !== undefined && <span className="ml-1.5 text-ink-3 tabular">({o.count})</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Glass filter panel. On small screens it collapses behind a toggle that shows
 * how many filters are active.
 */
export function FilterPanel({
  children,
  activeCount,
  onClear,
  lead,
}: {
  children: ReactNode;
  activeCount: number;
  onClear: () => void;
  lead?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Filters" className="glass rounded-3xl p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{lead}</div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X /> Clear {activeCount}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            aria-expanded={open}
            aria-controls="filter-fields"
            onClick={() => setOpen((v) => !v)}
          >
            <SlidersHorizontal /> Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
        </div>
      </div>
      <div
        id="filter-fields"
        className={cn('mt-3 grid-cols-2 gap-3 md:grid md:grid-cols-4', open ? 'grid' : 'hidden')}
      >
        {children}
      </div>
    </section>
  );
}
