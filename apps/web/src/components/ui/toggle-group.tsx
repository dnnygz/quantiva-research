import * as React from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/** Pill segmented control (single choice). */
export function Segmented({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn('inline-flex flex-wrap items-center gap-1 rounded-full bg-[#e6f2fa]/80 p-1 ring-1 ring-white', className)}
      {...props}
    />
  );
}

export function SegmentedItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[0.8rem] font-semibold text-ink-2 transition-all duration-200 hover:text-ink data-[state=on]:bg-white data-[state=on]:text-ink data-[state=on]:shadow-soft',
        className,
      )}
      {...props}
    />
  );
}
