import * as React from 'react';
import { cn } from '@/lib/utils';

/** Glass surface for hero, navigation, filters and summaries. */
export function GlassCard({
  className,
  gloss = false,
  as: Comp = 'div',
  ...props
}: React.HTMLAttributes<HTMLElement> & { gloss?: boolean; as?: React.ElementType }) {
  return <Comp className={cn('glass rounded-3xl', gloss && 'glass-gloss', className)} {...props} />;
}

/** Solid, high-contrast surface for tables and charts. */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('panel rounded-3xl', className)} {...props} />;
}
