import { and, asc, eq, isNull, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Catalog } from '@qa/shared';
import {
  datasets,
  experiments,
  figures,
  protocols,
  researchLines,
} from '../db/schema';
import type { AppEnv } from '../env';
import { getSessionUser, readSessionCookie } from '../services/session';
import {
  loadComparisonSets,
  loadExperimentDetail,
  loadExperiments,
  loadQuestions,
  toFigure,
} from '../services/serialize';

export const publicRoutes = new Hono<AppEnv>();

const slugParam = z.string().trim().min(1).max(120);
const idParam = z.coerce.number().int().positive();
const optionalSlug = slugParam.optional();

/** A figure is public if it has no experiment or its experiment is published. */
const figureIsPublic = or(isNull(figures.experimentId), eq(experiments.status, 'published'));

publicRoutes.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

publicRoutes.get('/catalog', async (c) => {
  const db = c.var.db;
  const [lines, ds, ps, sets] = await Promise.all([
    db.select().from(researchLines).orderBy(asc(researchLines.sortOrder), asc(researchLines.id)),
    db.select().from(datasets).orderBy(asc(datasets.id)),
    db.select().from(protocols).orderBy(asc(protocols.id)),
    loadComparisonSets(db, true),
  ]);
  const body: Catalog = {
    researchLines: lines.map(({ createdAt: _c, ...l }) => l),
    datasets: ds,
    protocols: ps,
    comparisonSets: sets,
  };
  return c.json(body);
});

const experimentFilters = z.object({
  line: optionalSlug,
  dataset: optionalSlug,
  protocol: optionalSlug,
  factor: z.string().trim().max(64).optional(),
});

publicRoutes.get('/experiments', async (c) => {
  const db = c.var.db;
  const q = experimentFilters.parse(c.req.query());
  const conds: SQL[] = [eq(experiments.status, 'published')];
  if (q.line) {
    const [row] = await db.select({ id: researchLines.id }).from(researchLines).where(eq(researchLines.slug, q.line));
    if (!row) return c.json([]);
    conds.push(eq(experiments.researchLineId, row.id));
  }
  if (q.dataset) {
    const [row] = await db.select({ id: datasets.id }).from(datasets).where(eq(datasets.slug, q.dataset));
    if (!row) return c.json([]);
    conds.push(eq(experiments.datasetId, row.id));
  }
  if (q.protocol) {
    const [row] = await db.select({ id: protocols.id }).from(protocols).where(eq(protocols.slug, q.protocol));
    if (!row) return c.json([]);
    conds.push(eq(experiments.protocolId, row.id));
  }
  if (q.factor) conds.push(eq(experiments.factor, q.factor));
  return c.json(await loadExperiments(db, and(...conds)));
});

publicRoutes.get('/experiments/:slug', async (c) => {
  const slug = slugParam.parse(c.req.param('slug'));
  const detail = await loadExperimentDetail(c.var.db, eq(experiments.slug, slug), true);
  if (!detail) return c.json({ error: 'Experiment not found' }, 404);
  return c.json(detail);
});

publicRoutes.get('/comparison-sets', async (c) => c.json(await loadComparisonSets(c.var.db, true)));

publicRoutes.get('/questions', async (c) => c.json(await loadQuestions(c.var.db, true)));

publicRoutes.get('/figures', async (c) => {
  const db = c.var.db;
  const q = z.object({ experiment: optionalSlug, line: optionalSlug }).parse(c.req.query());
  const conds: (SQL | undefined)[] = [figureIsPublic];
  if (q.experiment) conds.push(eq(experiments.slug, q.experiment));
  if (q.line) {
    const [row] = await db.select({ id: researchLines.id }).from(researchLines).where(eq(researchLines.slug, q.line));
    if (!row) return c.json([]);
    conds.push(eq(figures.researchLineId, row.id));
  }
  const rows = await db
    .select({ figure: figures })
    .from(figures)
    .leftJoin(experiments, eq(experiments.id, figures.experimentId))
    .where(and(...conds))
    .orderBy(asc(figures.id));
  return c.json(rows.map((r) => toFigure(r.figure)));
});

publicRoutes.get('/figures/:id/image', async (c) => {
  const db = c.var.db;
  const id = idParam.parse(c.req.param('id'));
  const [row] = await db
    .select({ storageKey: figures.storageKey, contentType: figures.contentType, status: experiments.status, experimentId: figures.experimentId })
    .from(figures)
    .leftJoin(experiments, eq(experiments.id, figures.experimentId))
    .where(eq(figures.id, id));
  if (!row) return c.json({ error: 'Figure not found' }, 404);
  const isPublic = row.experimentId === null || row.status === 'published';
  // Figures of draft experiments are only served to a logged-in admin (for previews).
  if (!isPublic && !(await getSessionUser(db, readSessionCookie(c)))) {
    return c.json({ error: 'Figure not found' }, 404);
  }
  const object = await c.env.FIGURES.get(row.storageKey);
  if (!object) return c.json({ error: 'Figure image not found' }, 404);
  return new Response(object.body, {
    headers: {
      'Content-Type': row.contentType,
      'Content-Length': String(object.size),
      'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      ETag: object.httpEtag,
    },
  });
});
