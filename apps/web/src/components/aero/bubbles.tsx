import { cn } from '@/lib/utils';

interface BubbleSpec {
  size: number;
  top: string;
  left: string;
  delay?: number;
  slow?: boolean;
  opacity?: number;
}

const PRESETS: Record<'hero' | 'section' | 'corner', BubbleSpec[]> = {
  hero: [
    { size: 120, top: '8%', left: '4%', opacity: 0.85 },
    { size: 46, top: '62%', left: '10%', delay: 3, slow: true },
    { size: 28, top: '18%', left: '44%', delay: 6 },
    { size: 74, top: '74%', left: '52%', delay: 2, slow: true, opacity: 0.7 },
    { size: 18, top: '40%', left: '58%', delay: 8 },
  ],
  section: [
    { size: 64, top: '-12%', left: '86%', slow: true, opacity: 0.8 },
    { size: 24, top: '30%', left: '95%', delay: 5 },
  ],
  corner: [{ size: 90, top: '-30%', left: '-6%', slow: true, opacity: 0.6 }],
};

/**
 * Decorative translucent bubbles. Purely presentational (aria-hidden),
 * slow float that stops under prefers-reduced-motion.
 */
export function BubbleField({ preset = 'hero', className }: { preset?: keyof typeof PRESETS; className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {PRESETS[preset].map((b, i) => (
        <span
          key={i}
          className={cn('bubble', b.slow ? 'animate-float-slower' : 'animate-float-slow')}
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            opacity: b.opacity ?? 1,
            animationDelay: `${-(b.delay ?? 0)}s`,
          }}
        />
      ))}
    </div>
  );
}
