import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  {
    variants: {
      variant: {
        aero: 'aero-button text-white rounded-full hover:brightness-105 hover:-translate-y-px active:translate-y-0',
        default: 'bg-primary text-primary-foreground rounded-full shadow-soft hover:bg-primary-700',
        glass:
          'glass rounded-full text-ink hover:bg-white/90 hover:-translate-y-px active:translate-y-0',
        outline: 'border border-line-strong bg-white/80 text-ink rounded-full hover:bg-white hover:border-primary-600/40',
        ghost: 'text-ink-2 rounded-full hover:bg-white/70 hover:text-ink',
        subtle: 'bg-primary-50 text-primary-700 rounded-full hover:bg-[#d3eff7]',
        destructive: 'bg-destructive text-white rounded-full hover:bg-[#a9380a]',
        link: 'text-primary-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 text-sm',
        sm: 'h-8 px-3.5 text-[0.8rem]',
        lg: 'h-12 px-7 text-[0.95rem]',
        icon: 'size-9 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
