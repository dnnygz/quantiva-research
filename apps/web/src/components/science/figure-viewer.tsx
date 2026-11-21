import { Link } from 'react-router';
import { Expand, ImageOff } from 'lucide-react';
import { useState } from 'react';
import type { Figure } from '@qa/shared';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useResearch } from '@/hooks/research-data';

function FigureImage({ figure, className }: { figure: Figure; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="grid h-full min-h-32 place-items-center bg-muted text-ink-3">
        <ImageOff className="size-5" aria-label="Image unavailable" />
      </div>
    );
  return (
    <img
      src={figure.url}
      alt={figure.title}
      loading="lazy"
      decoding="async"
      width={figure.width ?? undefined}
      height={figure.height ?? undefined}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

/** Thumbnail card that opens an enlarged view with caption and provenance. */
export function FigureViewer({ figure }: { figure: Figure }) {
  const { experimentsById } = useResearch();
  const exp = figure.experimentId != null ? experimentsById.get(figure.experimentId) : undefined;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="group panel flex w-full flex-col overflow-hidden rounded-2xl text-left transition-all hover:-translate-y-0.5 hover:shadow-float">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-white p-3">
            <FigureImage figure={figure} className="h-full w-full object-contain" />
            <span className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-white/90 text-ink-2 opacity-0 shadow-soft transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Expand className="size-4" />
            </span>
          </div>
          <div className="border-t border-line p-3">
            <p className="line-clamp-1 text-sm font-semibold">{figure.title}</p>
            {figure.source && <p className="mt-0.5 text-xs text-ink-3">{figure.source}</p>}
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogTitle>{figure.title}</DialogTitle>
        {figure.source && <p className="text-xs font-medium text-ink-3">{figure.source}</p>}
        <div className="mt-4 overflow-auto rounded-2xl bg-white ring-1 ring-line">
          <FigureImage figure={figure} className="mx-auto h-auto max-h-[65dvh] w-auto max-w-full object-contain" />
        </div>
        <DialogDescription className="mt-4 leading-relaxed">{figure.description}</DialogDescription>
        {exp && (
          <p className="mt-3 text-sm">
            Related experiment:{' '}
            <Link className="font-semibold text-primary-600 hover:underline" to={`/experiments/${exp.slug}`}>
              {exp.title}
            </Link>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
