import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BubbleField } from '@/components/aero/bubbles';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('relative pt-10 pb-8 sm:pt-14', className)}>
      <BubbleField preset="section" className="-z-10" />
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl animate-rise">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="text-3xl font-bold sm:text-[2.6rem] sm:leading-[1.1]">{title}</h1>
          {description && <p className="mt-3 text-base leading-relaxed text-ink-2 sm:text-[1.05rem]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  icon,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        <h2 id={id} className="flex items-center gap-2.5 text-xl font-bold sm:text-[1.4rem]">
          {icon && (
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-b from-white to-[#dff2fb] text-primary-600 shadow-soft ring-1 ring-white [&_svg]:size-4">
              {icon}
            </span>
          )}
          {title}
        </h2>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
