import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
  experimentInputSchema,
  experimentUpdateSchema,
  figureMetaSchema,
  figureUpdateSchema,
  FIGURE_MAX_BYTES,
  findingInputSchema,
  findingUpdateSchema,
  metricCreateSchema,
  metricUpdateSchema,
  questionInputSchema,
  questionUpdateSchema,
  trainingHistorySchema,
} from '@qa/shared';
import type { Db } from '../db/client';
import {
  comparisonSetExperiments,
  experiments,
  figures,
  findingExperiments,
  findings,
  metrics,
  researchQuestions,
  trainingHistory,
} from '../db/schema';
import type { AppContext, AppEnv } from '../env';
import { requireAdmin } from '../middleware/auth';
import { newStorageKey, sniffImage } from '../services/figures';
import {
  loadExperimentDetail,
  loadExperiments,
  loadFinding,
  loadQuestion,
  loadQuestions,
  toFigure,
  toMetric,
} from '../services/serialize';

export const adminRoutes = new Hono<AppEnv>();
adminRoutes.use('*', requireAdmin);

const idParam = z.coerce.number().int().positive();
const paramId = (c: AppContext) => idParam.parse(c.req.param('id'));

async function jsonBody(c: AppContext): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HTTPException(400, { message: 'Expected a JSON object' });
  }
  return body as Record<string, unknown>;
}

/**
 * The shared *UpdateSchema objects are `.partial()` versions of schemas with defaults, and Zod 4
 * fills defaults even for absent keys. Keep only keys the client actually sent.
 */
function provided<T extends object>(parsed: T, raw: Record<string, unknown>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(parsed) as (keyof T)[]) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) out[key] = parsed[key];
  }
  return out;
}

const notFound = (what: string) => new HTTPException(404, { message: `${what} not found` });

async function touchExperiment(db: Db, id: number) {
  await db.update(experiments).set({ updatedAt: new Date() }).where(eq(experiments.id, id));
}

async function adminExperimentDetail(db: Db, id: number) {
  const detail = await loadExperimentDetail(db, eq(experiments.id, id), false);
  if (!detail) throw notFound('Experiment');
  const sets = await db
    .select({ setId: comparisonSetExperiments.setId })
    .from(comparisonSetExperiments)
    .where(eq(comparisonSetExperiments.experimentId, id))
    .orderBy(asc(comparisonSetExperiments.setId));
  return { ...detail, comparisonSetIds: sets.map((s) => s.setId) };
}

// ---------------------------------------------------------------- experiments

adminRoutes.get('/experiments', async (c) => c.json(await loadExperiments(c.var.db)));

adminRoutes.get('/experiments/:id', async (c) =>
  c.json(await adminExperimentDetail(c.var.db, paramId(c))),
);

adminRoutes.post('/experiments', async (c) => {
  const db = c.var.db;
  const { comparisonSetIds, metrics: metricInputs, ...fields } = experimentInputSchema.parse(
    await jsonBody(c),
  );
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(experiments).values(fields).returning({ id: experiments.id });
    const experimentId = row!.id;
    if (metricInputs.length > 0) {
      await tx.insert(metrics).values(metricInputs.map((m) => ({ ...m, experimentId })));
    }
    const setIds = [...new Set(comparisonSetIds)];
    if (setIds.length > 0) {
      await tx.insert(comparisonSetExperiments).values(setIds.map((setId) => ({ setId, experimentId })));
    }
    return experimentId;
  });
  return c.json(await adminExperimentDetail(db, id), 201);
});

adminRoutes.patch('/experiments/:id', async (c) => {
  const db = c.var.db;
  const id = paramId(c);
  const raw = await jsonBody(c);
  const { comparisonSetIds, ...fields } = provided(experimentUpdateSchema.parse(raw), raw);
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(experiments)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(experiments.id, id))
      .returning({ id: experiments.id });
    if (updated.length === 0) throw notFound('Experiment');
    if (comparisonSetIds) {
      await tx.delete(comparisonSetExperiments).where(eq(comparisonSetExperiments.experimentId, id));
      const setIds = [...new Set(comparisonSetIds)];
      if (setIds.length > 0) {
        await tx
          .insert(comparisonSetExperiments)
          .values(setIds.map((setId) => ({ setId, experimentId: id })));
      }
    }
  });
  return c.json(await adminExperimentDetail(db, id));
});

adminRoutes.delete('/experiments/:id', async (c) => {
  const deleted = await c.var.db
    .delete(experiments)
    .where(eq(experiments.id, paramId(c)))
    .returning({ id: experiments.id });
  if (deleted.length === 0) throw notFound('Experiment');
  return c.json({ ok: true });
});

adminRoutes.put('/experiments/:id/history', async (c) => {
  const db = c.var.db;
  const id = paramId(c);
  const { points } = trainingHistorySchema.parse(await jsonBody(c));
  const epochs = new Set(points.map((p) => p.epoch));
  if (epochs.size !== points.length) {
    throw new HTTPException(400, { message: 'Duplicate epochs in training history' });
  }
  await db.transaction(async (tx) => {
    const [exists] = await tx.select({ id: experiments.id }).from(experiments).where(eq(experiments.id, id));
    if (!exists) throw notFound('Experiment');
    await tx.delete(trainingHistory).where(eq(trainingHistory.experimentId, id));
    for (let i = 0; i < points.length; i += 1000) {
      await tx
        .insert(trainingHistory)
        .values(points.slice(i, i + 1000).map((p) => ({ ...p, experimentId: id })));
    }
    await tx.update(experiments).set({ updatedAt: new Date() }).where(eq(experiments.id, id));
  });
  return c.json(await adminExperimentDetail(db, id));
});

// -------------------------------------------------------------------- metrics

adminRoutes.post('/metrics', async (c) => {
  const db = c.var.db;
  const input = metricCreateSchema.parse(await jsonBody(c));
  const [row] = await db.insert(metrics).values(input).returning();
  await touchExperiment(db, input.experimentId);
  return c.json(toMetric(row!), 201);
});

adminRoutes.patch('/metrics/:id', async (c) => {
  const db = c.var.db;
  const raw = await jsonBody(c);
  const fields = provided(metricUpdateSchema.parse(raw), raw);
  const id = paramId(c);
  const [row] =
    Object.keys(fields).length > 0
      ? await db.update(metrics).set(fields).where(eq(metrics.id, id)).returning()
      : await db.select().from(metrics).where(eq(metrics.id, id));
  if (!row) throw notFound('Metric');
  await touchExperiment(db, row.experimentId);
  return c.json(toMetric(row));
});

adminRoutes.delete('/metrics/:id', async (c) => {
  const db = c.var.db;
  const [row] = await db.delete(metrics).where(eq(metrics.id, paramId(c))).returning();
  if (!row) throw notFound('Metric');
  await touchExperiment(db, row.experimentId);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ questions

adminRoutes.get('/questions', async (c) => c.json(await loadQuestions(c.var.db, false)));

adminRoutes.post('/questions', async (c) => {
  const db = c.var.db;
  const input = questionInputSchema.parse(await jsonBody(c));
  const [row] = await db.insert(researchQuestions).values(input).returning({ id: researchQuestions.id });
  return c.json(await loadQuestion(db, row!.id), 201);
});

adminRoutes.patch('/questions/:id', async (c) => {
  const db = c.var.db;
  const id = paramId(c);
  const raw = await jsonBody(c);
  const fields = provided(questionUpdateSchema.parse(raw), raw);
  const updated = await db
    .update(researchQuestions)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(researchQuestions.id, id))
    .returning({ id: researchQuestions.id });
  if (updated.length === 0) throw notFound('Question');
  return c.json(await loadQuestion(db, id));
});

adminRoutes.delete('/questions/:id', async (c) => {
  const deleted = await c.var.db
    .delete(researchQuestions)
    .where(eq(researchQuestions.id, paramId(c)))
    .returning({ id: researchQuestions.id });
  if (deleted.length === 0) throw notFound('Question');
  return c.json({ ok: true });
});

// ------------------------------------------------------------------- findings

adminRoutes.post('/findings', async (c) => {
  const db = c.var.db;
  const { experimentIds, ...fields } = findingInputSchema.parse(await jsonBody(c));
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(findings).values(fields).returning({ id: findings.id });
    const findingId = row!.id;
    const ids = [...new Set(experimentIds)];
    if (ids.length > 0) {
      await tx.insert(findingExperiments).values(ids.map((experimentId) => ({ findingId, experimentId })));
    }
    return findingId;
  });
  return c.json(await loadFinding(db, id), 201);
});

adminRoutes.patch('/findings/:id', async (c) => {
  const db = c.var.db;
  const id = paramId(c);
  const raw = await jsonBody(c);
  const { experimentIds, ...fields } = provided(findingUpdateSchema.parse(raw), raw);
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(findings)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(findings.id, id))
      .returning({ id: findings.id });
    if (updated.length === 0) throw notFound('Finding');
    if (experimentIds) {
      await tx.delete(findingExperiments).where(eq(findingExperiments.findingId, id));
      const ids = [...new Set(experimentIds)];
      if (ids.length > 0) {
        await tx.insert(findingExperiments).values(ids.map((experimentId) => ({ findingId: id, experimentId })));
      }
    }
  });
  return c.json(await loadFinding(db, id));
});

adminRoutes.delete('/findings/:id', async (c) => {
  const deleted = await c.var.db
    .delete(findings)
    .where(eq(findings.id, paramId(c)))
    .returning({ id: findings.id });
  if (deleted.length === 0) throw notFound('Finding');
  return c.json({ ok: true });
});

// -------------------------------------------------------------------- figures

/** Multipart fields arrive as strings; convert them to the types figureMetaSchema expects. */
function figureFieldsFromForm(form: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ['title', 'description'] as const) {
    if (typeof form[key] === 'string') out[key] = form[key];
  }
  if (typeof form.source === 'string') out.source = form.source.trim() === '' ? null : form.source;
  for (const key of ['experimentId', 'researchLineId'] as const) {
    const v = form[key];
    if (typeof v !== 'string') continue;
    const t = v.trim();
    out[key] = t === '' || t === 'null' ? null : Number(t);
  }
  return out;
}

async function readUpload(file: File) {
  if (file.size > FIGURE_MAX_BYTES) {
    throw new HTTPException(413, { message: `File exceeds ${FIGURE_MAX_BYTES} bytes` });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = sniffImage(bytes);
  if (!info) throw new HTTPException(415, { message: 'Only PNG, JPEG or WebP images are accepted' });
  return { bytes, info };
}

async function figureRow(db: Db, id: number) {
  const [row] = await db.select().from(figures).where(eq(figures.id, id));
  if (!row) throw notFound('Figure');
  return row;
}

adminRoutes.get('/figures', async (c) => {
  const rows = await c.var.db.select().from(figures).orderBy(asc(figures.id));
  return c.json(rows.map(toFigure));
});

adminRoutes.post('/figures', async (c) => {
  const db = c.var.db;
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw new HTTPException(400, { message: 'Missing file' });
  const meta = figureMetaSchema.parse(figureFieldsFromForm(form));
  const { bytes, info } = await readUpload(file);
  const storageKey = newStorageKey(info.ext);
  await c.env.FIGURES.put(storageKey, bytes, { httpMetadata: { contentType: info.mime } });
  try {
    const [row] = await db
      .insert(figures)
      .values({ ...meta, storageKey, contentType: info.mime, width: info.width, height: info.height })
      .returning();
    return c.json(toFigure(row!), 201);
  } catch (err) {
    await c.env.FIGURES.delete(storageKey);
    throw err;
  }
});

adminRoutes.patch('/figures/:id', async (c) => {
  const db = c.var.db;
  const id = paramId(c);
  const isJson = (c.req.header('Content-Type') ?? '').includes('application/json');
  const raw = isJson ? await jsonBody(c) : figureFieldsFromForm(await c.req.parseBody());
  const fields = provided(figureUpdateSchema.parse(raw), raw);
  const current = await figureRow(db, id);

  let upload: Awaited<ReturnType<typeof readUpload>> | null = null;
  if (!isJson) {
    const form = await c.req.parseBody(); // cached by Hono
    if (form.file instanceof File) upload = await readUpload(form.file);
  }

  let newKey: string | null = null;
  if (upload) {
    newKey = newStorageKey(upload.info.ext);
    await c.env.FIGURES.put(newKey, upload.bytes, { httpMetadata: { contentType: upload.info.mime } });
  }
  if (!upload && Object.keys(fields).length === 0) return c.json(toFigure(current));
  try {
    const [row] = await db
      .update(figures)
      .set({
        ...fields,
        ...(upload && newKey
          ? {
              storageKey: newKey,
              contentType: upload.info.mime,
              width: upload.info.width,
              height: upload.info.height,
            }
          : {}),
      })
      .where(eq(figures.id, id))
      .returning();
    if (newKey) await c.env.FIGURES.delete(current.storageKey);
    return c.json(toFigure(row!));
  } catch (err) {
    if (newKey) await c.env.FIGURES.delete(newKey);
    throw err;
  }
});

adminRoutes.delete('/figures/:id', async (c) => {
  const db = c.var.db;
  const row = await figureRow(db, paramId(c));
  await db.delete(figures).where(eq(figures.id, row.id));
  await c.env.FIGURES.delete(row.storageKey);
  return c.json({ ok: true });
});
