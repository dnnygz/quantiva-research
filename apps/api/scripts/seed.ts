/**
 * Idempotent seed from data/seed/*.json (upsert by slug). Never touches admin users or sessions.
 *   npm run db:seed -w @qa/api
 *
 * - Lines, datasets, protocols, experiments, comparison sets, questions: upsert by slug.
 * - Metrics of seeded experiments and memberships of seeded comparison sets are replaced.
 * - Findings have no slug: they are matched by (question, sortOrder) and updated in place;
 *   their experiment links are replaced.
 * - Figures: upsert by storage_key `seed/<file>`; width/height read from the PNG header.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, getTableColumns, inArray, sql as dsql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Aggregation, Agreement, ModelFamily, Split, Status } from '@qa/shared';
import {
  comparisonSetExperiments,
  comparisonSets,
  datasets,
  experiments,
  figures,
  findingExperiments,
  findings,
  metrics,
  protocols,
  researchLines,
  researchQuestions,
} from '../src/db/schema';
import { sniffImage } from '../src/services/figures';
import { connect, redactedUrl } from './db';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(join(dataDir, 'seed', `${name}.json`), 'utf8')) as T;

interface SeedLine { slug: string; code: string; name: string; shortName: string; manuscriptTitle: string; description: string; sortOrder: number }
interface SeedDataset { slug: string; name: string; shortName: string; samples: string | null; features: string | null; description: string }
interface SeedProtocol { slug: string; line: string; name: string; evaluation: string; description: string; limitations: string }
interface SeedExperiment {
  slug: string; line: string; protocol: string; dataset: string | null; title: string; modelName: string;
  modelFamily: ModelFamily; variant: string | null; setting: string | null; factor: string; objective: string;
  description: string; configuration: Record<string, unknown> | null; fold: number | null; seed: number | null;
  nSeeds: number | null; nFolds: number | null; observations: string | null; limitations: string | null;
  source: string; status: Status; sortOrder: number;
}
interface SeedMetric { experiment: string; metricName: string; value: number; split: Split | null; aggregation: Aggregation | null; unit: string | null; source: string | null }
interface SeedSet { slug: string; line: string; protocol: string; factor: string; name: string; rowLabel: string; description: string; experiments: string[]; sortOrder: number }
interface SeedFinding { line?: string; observation: string; interpretation: string; limitations: string; experiments: string[]; status: Status; sortOrder: number }
interface SeedQuestion { slug: string; question: string; context: string; agreement: Agreement; openQuestions: string; status: Status; sortOrder: number; findings: SeedFinding[] }
interface SeedFigure { file: string; line: string; experiment?: string | null; title: string; description: string; source: string | null }

function lookup(map: Map<string, number>, slug: string, what: string): number {
  const id = map.get(slug);
  if (id === undefined) throw new Error(`Seed references unknown ${what} "${slug}"`);
  return id;
}

/** `{ key: excluded."<column>" }` for every listed property, for ON CONFLICT DO UPDATE. */
function excluded<T extends PgTable>(table: T, keys: (keyof T['$inferInsert'] & string)[]) {
  const cols = getTableColumns(table) as Record<string, { name: string }>;
  return Object.fromEntries(keys.map((k) => [k, dsql.raw(`excluded."${cols[k]!.name}"`)]));
}

const { sql, db } = connect();
try {
  console.log(`Seeding ${redactedUrl()} ...`);
  const summary: Record<string, number> = {};

  await db.transaction(async (tx) => {
    // Research lines
    const lineIds = new Map<string, number>();
    for (const l of read<SeedLine[]>('research-lines')) {
      const values = { slug: l.slug, code: l.code, name: l.name, shortName: l.shortName, description: l.description, manuscriptTitle: l.manuscriptTitle, sortOrder: l.sortOrder };
      const [row] = await tx.insert(researchLines).values(values)
        .onConflictDoUpdate({ target: researchLines.slug, set: excluded(researchLines, ['code', 'name', 'shortName', 'description', 'manuscriptTitle', 'sortOrder']) })
        .returning({ id: researchLines.id });
      lineIds.set(l.slug, row!.id);
    }
    summary.researchLines = lineIds.size;

    // Datasets
    const datasetIds = new Map<string, number>();
    for (const d of read<SeedDataset[]>('datasets')) {
      const [row] = await tx.insert(datasets).values(d)
        .onConflictDoUpdate({ target: datasets.slug, set: excluded(datasets, ['name', 'shortName', 'description', 'samples', 'features']) })
        .returning({ id: datasets.id });
      datasetIds.set(d.slug, row!.id);
    }
    summary.datasets = datasetIds.size;

    // Protocols
    const protocolIds = new Map<string, number>();
    for (const p of read<SeedProtocol[]>('protocols')) {
      const { line, ...rest } = p;
      const [row] = await tx.insert(protocols).values({ ...rest, researchLineId: lookup(lineIds, line, 'line') })
        .onConflictDoUpdate({ target: protocols.slug, set: excluded(protocols, ['researchLineId', 'name', 'evaluation', 'description', 'limitations']) })
        .returning({ id: protocols.id });
      protocolIds.set(p.slug, row!.id);
    }
    summary.protocols = protocolIds.size;

    // Experiments
    const experimentIds = new Map<string, number>();
    for (const e of read<SeedExperiment[]>('experiments')) {
      const { line, protocol, dataset, ...rest } = e;
      const values = {
        ...rest,
        researchLineId: lookup(lineIds, line, 'line'),
        protocolId: lookup(protocolIds, protocol, 'protocol'),
        datasetId: dataset ? lookup(datasetIds, dataset, 'dataset') : null,
      };
      const [row] = await tx.insert(experiments).values(values)
        .onConflictDoUpdate({
          target: experiments.slug,
          set: {
            ...excluded(experiments, ['researchLineId', 'protocolId', 'datasetId', 'title', 'modelName', 'modelFamily', 'variant', 'setting', 'factor', 'objective', 'description', 'configuration', 'fold', 'seed', 'nSeeds', 'nFolds', 'observations', 'limitations', 'source', 'status', 'sortOrder']),
            updatedAt: new Date(),
          },
        })
        .returning({ id: experiments.id });
      experimentIds.set(e.slug, row!.id);
    }
    summary.experiments = experimentIds.size;

    // Metrics: replace for seeded experiments
    const seededIds = [...experimentIds.values()];
    await tx.delete(metrics).where(inArray(metrics.experimentId, seededIds));
    const metricRows = read<SeedMetric[]>('metrics').map(({ experiment, ...m }) => ({
      ...m,
      experimentId: lookup(experimentIds, experiment, 'experiment'),
    }));
    for (let i = 0; i < metricRows.length; i += 500) {
      await tx.insert(metrics).values(metricRows.slice(i, i + 500));
    }
    summary.metrics = metricRows.length;

    // Comparison sets + memberships
    let memberships = 0;
    const sets = read<SeedSet[]>('comparison-sets');
    for (const s of sets) {
      const { line, protocol, experiments: members, ...rest } = s;
      const [row] = await tx.insert(comparisonSets)
        .values({ ...rest, researchLineId: lookup(lineIds, line, 'line'), protocolId: lookup(protocolIds, protocol, 'protocol') })
        .onConflictDoUpdate({ target: comparisonSets.slug, set: excluded(comparisonSets, ['researchLineId', 'protocolId', 'name', 'description', 'factor', 'rowLabel', 'sortOrder']) })
        .returning({ id: comparisonSets.id });
      const setId = row!.id;
      await tx.delete(comparisonSetExperiments).where(eq(comparisonSetExperiments.setId, setId));
      const ids = [...new Set(members.map((m) => lookup(experimentIds, m, 'experiment')))];
      if (ids.length > 0) {
        await tx.insert(comparisonSetExperiments).values(ids.map((experimentId) => ({ setId, experimentId })));
      }
      memberships += ids.length;
    }
    summary.comparisonSets = sets.length;
    summary.comparisonSetMemberships = memberships;

    // Questions + findings + links
    let findingCount = 0;
    let findingLinks = 0;
    const questions = read<SeedQuestion[]>('findings');
    for (const q of questions) {
      const { findings: qFindings, ...rest } = q;
      const [row] = await tx.insert(researchQuestions).values(rest)
        .onConflictDoUpdate({
          target: researchQuestions.slug,
          set: { ...excluded(researchQuestions, ['question', 'context', 'agreement', 'openQuestions', 'status', 'sortOrder']), updatedAt: new Date() },
        })
        .returning({ id: researchQuestions.id });
      const questionId = row!.id;
      const existing = await tx.select({ id: findings.id, sortOrder: findings.sortOrder })
        .from(findings).where(eq(findings.questionId, questionId));
      const bySort = new Map(existing.map((f) => [f.sortOrder, f.id]));
      for (const f of qFindings) {
        const values = {
          questionId,
          researchLineId: f.line ? lookup(lineIds, f.line, 'line') : null,
          observation: f.observation,
          interpretation: f.interpretation,
          limitations: f.limitations,
          status: f.status,
          sortOrder: f.sortOrder,
        };
        let findingId = bySort.get(f.sortOrder);
        if (findingId === undefined) {
          const [ins] = await tx.insert(findings).values(values).returning({ id: findings.id });
          findingId = ins!.id;
          bySort.set(f.sortOrder, findingId);
        } else {
          await tx.update(findings).set({ ...values, updatedAt: new Date() }).where(eq(findings.id, findingId));
        }
        await tx.delete(findingExperiments).where(eq(findingExperiments.findingId, findingId));
        const ids = [...new Set(f.experiments.map((s) => lookup(experimentIds, s, 'experiment')))];
        if (ids.length > 0) {
          await tx.insert(findingExperiments).values(ids.map((experimentId) => ({ findingId: findingId!, experimentId })));
        }
        findingCount++;
        findingLinks += ids.length;
      }
    }
    summary.questions = questions.length;
    summary.findings = findingCount;
    summary.findingExperimentLinks = findingLinks;

    // Figures (rows only; upload the images with `npm run figures:seed`)
    const figs = read<SeedFigure[]>('figures');
    for (const f of figs) {
      const bytes = new Uint8Array(readFileSync(join(dataDir, 'figures', f.file)));
      const info = sniffImage(bytes);
      if (!info) throw new Error(`data/figures/${f.file} is not a PNG/JPEG/WebP image`);
      const values = {
        researchLineId: lookup(lineIds, f.line, 'line'),
        experimentId: f.experiment ? lookup(experimentIds, f.experiment, 'experiment') : null,
        title: f.title,
        description: f.description,
        source: f.source,
        storageKey: `seed/${f.file}`,
        contentType: info.mime,
        width: info.width,
        height: info.height,
      };
      await tx.insert(figures).values(values)
        .onConflictDoUpdate({ target: figures.storageKey, set: excluded(figures, ['researchLineId', 'experimentId', 'title', 'description', 'source', 'contentType', 'width', 'height']) });
    }
    summary.figures = figs.length;
  });

  console.log('Seed complete:');
  console.table(summary);
} catch (err) {
  console.error('Seed failed:', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
