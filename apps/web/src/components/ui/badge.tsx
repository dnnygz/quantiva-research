import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold leading-5 whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-white/80 text-ink-2 ring-1 ring-line',
        sky: 'bg-[#e3f3fd] text-[#155a86] ring-1 ring-[#c5e5fa]',
        mint: 'bg-[#e4f6ee] text-mint-700 ring-1 ring-[#c4ead8]',
        lavender: 'bg-[#efebff] text-lavender-700 ring-1 ring-[#ddd4ff]',
        lime: 'bg-[#f2fbe0] text-[#4f6b12] ring-1 ring-[#dff1b6]',
        amber: 'bg-[#fff4e0] text-[#8a4b06] ring-1 ring-[#f8deb0]',
        muted: 'bg-muted text-ink-3',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
