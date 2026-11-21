/**
 * Builds the initial seed JSON files from the two manuscripts.
 *
 *   npm run seed:build
 *
 * Every number below is transcribed from a table, a figure data label or the
 * running text of the manuscripts, and carries a `source` string pointing to
 * where it was published. Nothing is interpolated, rounded differently,
 * derived or synthesized. Where a manuscript does not report a value, no row
 * is created and the UI shows the value as unavailable.
 *
 *   Manuscript A — "A Controlled Analysis of the Factors Behind the
 *                   Generalization Gap of Variational Quantum Classifiers in
 *                   Simulated Environments" (Research Line A)
 *   Manuscript B — "Learned Representations, Geometry, and Variational
 *                   Readouts: A TCGA-BRCA Case Study" (Research Line B)
 *
 * Note: Manuscript A, Table V reports the TCGA-BRCA pipelines of Line B
 * (same folds and seeds). Those values are attached to the Line B experiments
 * with their own source string rather than duplicated as new experiments.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const A = 'Manuscript A';
const B = 'Manuscript B';

type Split = 'train' | 'test' | 'validation' | null;
type Agg =
  | 'single_run'
  | 'mean_over_seeds'
  | 'mean_over_folds_and_seeds'
  | 'fold_mean_over_seeds'
  | 'std_between_fold_means'
  | 'range_min'
  | 'range_max';

interface SeedMetric {
  metricName: string;
  value: number;
  split: Split;
  aggregation: Agg | null;
  unit: string | null;
  source: string;
}

interface SeedExperiment {
  slug: string;
  line: 'factors-behind-generalization' | 'representation-and-readout';
  protocol: string;
  dataset: string | null;
  title: string;
  modelName: string;
  modelFamily: 'quantum' | 'classical' | 'hybrid';
  variant: string | null;
  setting: string | null;
  factor: string;
  objective: string;
  description: string;
  configuration: Record<string, unknown> | null;
  fold: number | null;
  seed: number | null;
  nSeeds: number | null;
  nFolds: number | null;
  observations: string | null;
  limitations: string | null;
  source: string;
  status: 'published';
  sortOrder: number;
  metrics: SeedMetric[];
}

// ---------------------------------------------------------------------------
// Research lines, datasets, protocols
// ---------------------------------------------------------------------------

const researchLines = [
  {
    slug: 'factors-behind-generalization',
    code: 'A',
    name: 'Factors Behind Generalization',
    shortName: 'Factors',
    manuscriptTitle:
      'A Controlled Analysis of the Factors Behind the Generalization Gap of Variational Quantum Classifiers in Simulated Environments',
    description:
      'Measures the train–test gap of a four-qubit VQC against five classical models with the same four inputs on four tabular datasets, then varies one factor at a time: input representation, data encoding, circuit capacity and readout, training-set size, optimization budget and a classical teacher.',
    sortOrder: 1,
  },
  {
    slug: 'representation-and-readout',
    code: 'B',
    name: 'Representation & Readout',
    shortName: 'Readout',
    manuscriptTitle:
      'Learned Representations, Geometry, and Variational Readouts: A TCGA-BRCA Case Study',
    description:
      'Follows a four-qubit VQC on an ER-status task from TCGA-BRCA RNA-seq: fixed principal components versus a learned encoder, frozen-embedding readout controls, supervised quantum-fidelity and Gaussian geometry, and a same-embedding comparison of quantum and logistic readouts.',
    sortOrder: 2,
  },
];

const datasets = [
  {
    slug: 'wdbc',
    name: 'Wisconsin Diagnostic Breast Cancer',
    shortName: 'WDBC',
    samples: '569',
    features: '30',
    description: 'Tabular benchmark used as an easy reference in Line A.',
  },
  {
    slug: 'ionosphere',
    name: 'Ionosphere',
    shortName: 'Ionosphere',
    samples: '351',
    features: '33',
    description: 'Radar returns; used as harder data in Line A.',
  },
  {
    slug: 'synthetic',
    name: 'Synthetic (make_classification)',
    shortName: 'Synthetic',
    samples: '600',
    features: '30 (4 informative, 5% label noise)',
    description: "scikit-learn make_classification data used in Line A.",
  },
  {
    slug: 'blood-transfusion',
    name: 'Blood Transfusion',
    shortName: 'Transfusion',
    samples: '748',
    features: '4 (native)',
    description:
      'Four native features, used as-is (no reduction). Added in Line A after the baseline results of the other datasets.',
  },
  {
    slug: 'synthetic-frequency',
    name: 'Synthetic frequency tasks',
    shortName: 'Freq. tasks',
    samples: '600 per seed (new sample)',
    features: null,
    description:
      'Synthetic tasks whose label depends on frequency k (additive or product of sines), used for the encoding hypothesis (H2) in Line A.',
  },
  {
    slug: 'tcga-brca',
    name: 'TCGA-BRCA (ER status)',
    shortName: 'TCGA-BRCA',
    samples: '1,044 patients; 835 development, 209 locked test (not evaluated)',
    features: '60,660 genes (RNA-seq, STAR-Counts)',
    description:
      'Estrogen-receptor status (ER+ vs ER−) from primary breast-tumor RNA-seq profiles distributed by the NCI Genomic Data Commons. Open-access, de-identified research records. Not a clinical diagnostic setting.',
  },
];

const protocols = [
  {
    slug: 'a-resplits-30',
    line: 'factors-behind-generalization',
    name: '30 stratified re-splits (70/30)',
    evaluation: '30 seeds (0–29) · stratified 70/30 split per seed · test split · means over 30 seeds',
    description:
      'Features standardized, reduced to four principal components and rescaled to [−π, π], all fitted on the training part only. Four-qubit VQC with angle encoding, two RY/RZ layers with a CNOT chain, ⟨Z⟩ on four qubits, linear layer and sigmoid; exact noise-free simulation; full-batch Adam, learning rate 0.05, 200 epochs. Comparators receive the same four inputs and splits. Differences are paired by seed.',
    limitations:
      'The 30 seeds are re-splits of the same data, so intervals are optimistic. Factor intervals are uncorrected. Noise-free simulation with four qubits and one circuit family. Learning rate and epochs were fixed once and shared by the VQC and the MLP.',
  },
  {
    slug: 'a-frequency-tasks',
    line: 'factors-behind-generalization',
    name: 'Synthetic frequency tasks',
    evaluation: 'New sample of 600 points per seed · 30 seeds · test split · means over 30 seeds',
    description:
      'Synthetic tasks whose label depends on frequency k (additive or product of sines). Used to test whether matching the encoding frequency to the target recovers performance.',
    limitations:
      'Synthetic tasks only; extra frequencies did not help on the real datasets. Noise-free simulation.',
  },
  {
    slug: 'b-dev-folds',
    line: 'representation-and-readout',
    name: '5 development folds × 3 seeds',
    evaluation:
      '835 development patients · 5 stratified folds (668 train / 167 validation) · seeds 1729, 1730, 1731 · fold-first means',
    description:
      'Gene filtering, TMM factors, log2-CPM, scaling and PCA fitted on each fold’s training subset. Three seed values averaged within a fold, then the five fold means averaged. Paired differences computed within matching fold–seed cells before aggregation. Analytic, noiseless CPU simulation; AdamW (lr 0.01, weight decay 0.001), batch size 32, 50 epochs per stage. The 209 locked-test patients were not used.',
    limitations:
      'Validation folds of a reused development set: standard deviations between fold means describe variation among reused partitions and are not confidence intervals. No confirmatory statistical tests, no fresh cohort, a single binary biomedical task. Not a clinical tool.',
  },
];

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------

const experiments: SeedExperiment[] = [];
let order = 0;

function m(
  metricName: string,
  value: number,
  split: Split,
  aggregation: Agg | null,
  source: string,
  unit: string | null = null,
): SeedMetric {
  return { metricName, value, split, aggregation, unit, source };
}

function add(e: Omit<SeedExperiment, 'status' | 'sortOrder' | 'fold' | 'seed'> & {
  fold?: number | null;
  seed?: number | null;
}) {
  if (experiments.some((x) => x.slug === e.slug)) throw new Error(`duplicate slug ${e.slug}`);
  experiments.push({ fold: null, seed: null, ...e, status: 'published', sortOrder: order++ });
}

const LINE_A = 'factors-behind-generalization' as const;
const LINE_B = 'representation-and-readout' as const;

const A_DATASETS = [
  { slug: 'wdbc', name: 'WDBC' },
  { slug: 'ionosphere', name: 'Ionosphere' },
  { slug: 'synthetic', name: 'Synthetic' },
  { slug: 'blood-transfusion', name: 'Blood Transfusion' },
] as const;

const A_MODELS = {
  VQC: { family: 'quantum', full: 'Variational quantum classifier', desc: 'Four-qubit VQC (16 circuit + 5 readout parameters; 17 effective).' },
  LR: { family: 'classical', full: 'Logistic regression', desc: 'Logistic regression with default settings.' },
  SVM: { family: 'classical', full: 'Support vector machine (RBF)', desc: 'RBF-kernel SVM with default settings.' },
  RF: { family: 'classical', full: 'Random forest', desc: 'Random forest, 200 trees.' },
  XGBoost: { family: 'classical', full: 'XGBoost', desc: 'XGBoost, 200 trees, depth 3.' },
  MLP: { family: 'classical', full: 'Multilayer perceptron', desc: 'MLP with three tanh units (19 parameters), same optimizer, learning rate and epochs as the VQC.' },
} as const;
type AModel = keyof typeof A_MODELS;

// --- Line A · Table I: baseline with the same four inputs -------------------
const tableI: Record<string, Record<AModel, [number, number]>> = {
  wdbc: { VQC: [0.985, 0.007], LR: [0.991, 0.003], SVM: [0.991, 0.004], RF: [0.984, 0.016], XGBoost: [0.986, 0.014], MLP: [0.991, 0.005] },
  ionosphere: { VQC: [0.863, 0.054], LR: [0.884, 0.01], SVM: [0.917, 0.027], RF: [0.931, 0.069], XGBoost: [0.912, 0.088], MLP: [0.896, 0.049] },
  synthetic: { VQC: [0.757, 0.052], LR: [0.679, 0.011], SVM: [0.774, 0.062], RF: [0.755, 0.245], XGBoost: [0.741, 0.251], MLP: [0.763, 0.043] },
  'blood-transfusion': { VQC: [0.745, 0.019], LR: [0.755, -0.001], SVM: [0.705, 0.017], RF: [0.69, 0.283], XGBoost: [0.708, 0.186], MLP: [0.75, 0.004] },
};

const baselineSlug = (ds: string, model: AModel) => `a-baseline-${model.toLowerCase()}-${ds}`;

for (const ds of A_DATASETS) {
  for (const model of Object.keys(A_MODELS) as AModel[]) {
    const [auc, gap] = tableI[ds.slug]![model];
    const info = A_MODELS[model];
    add({
      slug: baselineSlug(ds.slug, model),
      line: LINE_A,
      protocol: 'a-resplits-30',
      dataset: ds.slug,
      title: `${info.full} on ${ds.name}, four shared inputs`,
      modelName: model,
      modelFamily: info.family,
      variant: null,
      setting: null,
      factor: 'baseline',
      objective:
        'Measure test AUC and the train–test gap of each model when all models receive the same four inputs.',
      description: `${info.desc} Inputs: ${ds.slug === 'blood-transfusion' ? 'the four native features' : 'four principal components fitted on the training split'}, rescaled to [−π, π].`,
      configuration: {
        inputs: ds.slug === 'blood-transfusion' ? '4 native features' : 'PCA-4',
        ...(model === 'VQC' ? { qubits: 4, layers: 2, epochs: 200, learning_rate: 0.05, optimizer: 'Adam (full batch)' } : {}),
      },
      nSeeds: 30,
      nFolds: null,
      observations: null,
      limitations: null,
      source: `${A}, Table I`,
      metrics: [
        m('roc_auc', auc, 'test', 'mean_over_seeds', `${A}, Table I`),
        m('gen_gap', gap, null, 'mean_over_seeds', `${A}, Table I`),
      ],
    });
  }
}

// --- Line A · Table II: encoding (H2) on synthetic frequency tasks ----------
const tableII: Array<{
  task: string;
  key: string;
  vqc: number;
  reup: number;
  x2: number;
  mlp: number;
  gapVqc: number;
  gapMlp: number;
}> = [
  { task: 'Additive, k=1', key: 'add-k1', vqc: 0.944, reup: 0.908, x2: 0.502, mlp: 0.892, gapVqc: 0.008, gapMlp: 0.007 },
  { task: 'Additive, k=2', key: 'add-k2', vqc: 0.49, reup: 0.822, x2: 0.936, mlp: 0.647, gapVqc: 0.156, gapMlp: 0.075 },
  { task: 'Additive, k=3', key: 'add-k3', vqc: 0.512, reup: 0.508, x2: 0.488, mlp: 0.578, gapVqc: 0.132, gapMlp: 0.083 },
  { task: 'Product, k=1', key: 'prod-k1', vqc: 0.938, reup: 0.507, x2: 0.501, mlp: 0.888, gapVqc: 0.014, gapMlp: 0.023 },
  { task: 'Product, k=2', key: 'prod-k2', vqc: 0.506, reup: 0.696, x2: 0.949, mlp: 0.554, gapVqc: 0.141, gapMlp: 0.103 },
  { task: 'Product, k=3', key: 'prod-k3', vqc: 0.501, reup: 0.486, x2: 0.513, mlp: 0.509, gapVqc: 0.144, gapMlp: 0.113 },
];
const src2 = `${A}, Table II`;
for (const t of tableII) {
  const common = {
    line: LINE_A,
    protocol: 'a-frequency-tasks',
    dataset: 'synthetic-frequency',
    setting: t.task,
    factor: 'encoding',
    objective:
      'Test whether the gap is larger on tasks that need frequencies the single-upload angle encoding cannot express (H2).',
    nSeeds: 30,
    nFolds: null,
    observations: null,
    limitations: null,
    source: src2,
  } as const;
  add({
    ...common,
    slug: `a-encoding-vqc-${t.key}`,
    title: `VQC, single upload — ${t.task}`,
    modelName: 'VQC',
    modelFamily: 'quantum',
    variant: 'Single upload',
    description: 'Four-qubit VQC with one angle-encoding upload.',
    configuration: { task: t.task, uploads: 1, angle_scale: 1 },
    metrics: [m('roc_auc', t.vqc, 'test', 'mean_over_seeds', src2), m('gen_gap', t.gapVqc, null, 'mean_over_seeds', src2)],
  });
  add({
    ...common,
    slug: `a-encoding-vqc-reupload-${t.key}`,
    title: `VQC with re-uploading — ${t.task}`,
    modelName: 'VQC',
    modelFamily: 'quantum',
    variant: 'Re-upload',
    description: 'Re-uploads the features before each layer.',
    configuration: { task: t.task, uploads: 'before each layer', angle_scale: 1 },
    metrics: [m('roc_auc', t.reup, 'test', 'mean_over_seeds', src2)],
  });
  add({
    ...common,
    slug: `a-encoding-vqc-x2-${t.key}`,
    title: `VQC with doubled angles — ${t.task}`,
    modelName: 'VQC',
    modelFamily: 'quantum',
    variant: '×2 angles',
    description: 'Doubles the encoding angles.',
    configuration: { task: t.task, uploads: 1, angle_scale: 2 },
    metrics: [m('roc_auc', t.x2, 'test', 'mean_over_seeds', src2)],
  });
  add({
    ...common,
    slug: `a-encoding-mlp-${t.key}`,
    title: `Multilayer perceptron — ${t.task}`,
    modelName: 'MLP',
    modelFamily: 'classical',
    variant: null,
    description: 'MLP comparator on the same task.',
    configuration: { task: t.task },
    metrics: [m('roc_auc', t.mlp, 'test', 'mean_over_seeds', src2), m('gen_gap', t.gapMlp, null, 'mean_over_seeds', src2)],
  });
}

// --- Line A · Table III: capacity and readout (H3) --------------------------
// "VQC, 2 layers (base)" and "MLP, 3 hidden" repeat the baseline configuration
// (identical values to Table I) and are linked through the comparison set,
// with their parameter counts attached to the baseline experiments.
const tableIII: Array<{
  key: string;
  model: 'VQC' | 'MLP';
  variant: string;
  title: string;
  params: [number, number];
  auc: [number, number, number, number];
  gap: [number, number, number, number];
  description: string;
}> = [
  { key: 'vqc-1-layer', model: 'VQC', variant: '1 layer', title: 'VQC with one variational layer', params: [13, 9], auc: [0.969, 0.804, 0.76, 0.709], gap: [0.008, 0.03, 0.031, 0.012], description: 'Single RY/RZ layer with CNOT chain.' },
  { key: 'mlp-2-hidden', model: 'MLP', variant: '2 hidden', title: 'MLP with two hidden units', params: [13, 13], auc: [0.991, 0.888, 0.747, 0.734], gap: [0.004, 0.026, 0.022, 0.006], description: 'Parameter-matched MLP for the one-layer VQC.' },
  { key: 'vqc-4-layers', model: 'VQC', variant: '4 layers', title: 'VQC with four variational layers', params: [37, 33], auc: [0.989, 0.912, 0.755, 0.743], gap: [0.007, 0.05, 0.086, 0.034], description: 'Four RY/RZ layers with CNOT chains.' },
  { key: 'mlp-6-hidden', model: 'MLP', variant: '6 hidden', title: 'MLP with six hidden units', params: [37, 37], auc: [0.99, 0.908, 0.763, 0.749], gap: [0.007, 0.065, 0.085, 0.017], description: 'Parameter-matched MLP for the four-layer VQC.' },
  { key: 'vqc-no-entanglement', model: 'VQC', variant: 'No entanglement', title: 'VQC without entangling gates', params: [21, 13], auc: [0.981, 0.881, 0.757, 0.741], gap: [0.005, 0.021, 0.027, 0.002], description: 'Two layers with the CNOT chain removed.' },
  { key: 'vqc-no-linear-head', model: 'VQC', variant: 'Fixed-sum readout', title: 'VQC with a fixed-sum readout (no linear head)', params: [17, 13], auc: [0.977, 0.815, 0.763, 0.74], gap: [0.003, 0.024, 0.02, 0.011], description: 'Replaces the trainable linear layer by a fixed-sum readout.' },
];
const src3 = `${A}, Table III`;
A_DATASETS.forEach((ds, i) => {
  for (const r of tableIII) {
    add({
      slug: `a-capacity-${r.key}-${ds.slug}`,
      line: LINE_A,
      protocol: 'a-resplits-30',
      dataset: ds.slug,
      title: `${r.title} on ${ds.name}`,
      modelName: r.model,
      modelFamily: r.model === 'VQC' ? 'quantum' : 'classical',
      variant: r.variant,
      setting: null,
      factor: 'capacity_readout',
      objective:
        'Test whether the gap depends on the effective number of parameters and the output head rather than on entanglement (H3).',
      description: r.description,
      configuration: { epochs: 200, nominal_parameters: r.params[0], effective_parameters: r.params[1] },
      nSeeds: 30,
      nFolds: null,
      observations: null,
      limitations: null,
      source: src3,
      metrics: [
        m('roc_auc', r.auc[i]!, 'test', 'mean_over_seeds', src3),
        m('gen_gap', r.gap[i]!, null, 'mean_over_seeds', src3),
        m('param_count_nominal', r.params[0], null, null, src3),
        m('param_count_effective', r.params[1], null, null, src3),
      ],
    });
  }
});
// Parameter counts of the base configurations (Table III rows "VQC, 2 layers (base)" and "MLP, 3 hidden").
for (const ds of A_DATASETS) {
  const vqc = experiments.find((e) => e.slug === baselineSlug(ds.slug, 'VQC'))!;
  vqc.metrics.push(m('param_count_nominal', 21, null, null, src3), m('param_count_effective', 17, null, null, src3));
  const mlp = experiments.find((e) => e.slug === baselineSlug(ds.slug, 'MLP'))!;
  mlp.metrics.push(m('param_count_nominal', 19, null, null, src3), m('param_count_effective', 19, null, null, src3));
}

// --- Line A · H4 training-set size (running text, Section IV-B) -------------
const h4: Record<string, number> = { wdbc: 0.07, ionosphere: 0.234, synthetic: 0.397, 'blood-transfusion': 0.278 };
for (const ds of A_DATASETS) {
  add({
    slug: `a-training-size-vqc-10pct-${ds.slug}`,
    line: LINE_A,
    protocol: 'a-resplits-30',
    dataset: ds.slug,
    title: `VQC trained on 10% of the training split — ${ds.name}`,
    modelName: 'VQC',
    modelFamily: 'quantum',
    variant: '10% data',
    setting: null,
    factor: 'training_size',
    objective: 'Test whether the gap shrinks as the training set grows (H4).',
    description:
      'Base VQC trained on 10% of the training split. The full curve (10–100%) for all models appears in Fig. 3 of the manuscript; only the values stated in the text are stored here.',
    configuration: { training_fraction: 0.1 },
    nSeeds: 30,
    nFolds: null,
    observations:
      'With 10% of the data, the gap of the VQC exceeded that of the MLP on all four datasets (by 0.049 to 0.118) and its test AUC was lower (−0.049 to −0.038).',
    limitations: 'Intermediate points of Fig. 3 are not tabulated in the manuscript and are not reproduced here.',
    source: `${A}, Section IV-B (H4)`,
    metrics: [m('gen_gap', h4[ds.slug]!, null, 'mean_over_seeds', `${A}, Section IV-B (H4)`)],
  });
}

// --- Line A · H5 optimization budget (running text) -------------------------
const h5: Record<string, [number, number]> = {
  wdbc: [0.004, 0.01],
  ionosphere: [0.024, 0.063],
  synthetic: [0.029, 0.061],
  'blood-transfusion': [0.005, 0.03],
};
for (const ds of A_DATASETS) {
  const [g25, g800] = h5[ds.slug]!;
  for (const [epochs, gap] of [
    [25, g25],
    [800, g800],
  ] as const) {
    add({
      slug: `a-optimization-vqc-${epochs}ep-${ds.slug}`,
      line: LINE_A,
      protocol: 'a-resplits-30',
      dataset: ds.slug,
      title: `VQC trained for ${epochs} epochs — ${ds.name}`,
      modelName: 'VQC',
      modelFamily: 'quantum',
      variant: `${epochs} epochs`,
      setting: null,
      factor: 'optimization',
      objective: 'Test whether part of the gap is an artifact of the training budget (H5).',
      description: `Base VQC trained for ${epochs} epochs instead of 200.`,
      configuration: { epochs, learning_rate: 0.05 },
      nSeeds: 30,
      nFolds: null,
      observations:
        'Between 25 and 800 epochs the gap of the VQC rose on every dataset, as it did for the MLP. Training from 200 to 800 epochs raised the gap on the synthetic data and Blood Transfusion (+0.009 and +0.010) without improving the test AUC.',
      limitations: 'Only the 25- and 800-epoch gaps of the VQC are stated numerically in the manuscript.',
      source: `${A}, Section IV-B (H5)`,
      metrics: [m('gen_gap', gap, null, 'mean_over_seeds', `${A}, Section IV-B (H5)`)],
    });
  }
}

// --- Line A · Table IV: classical teacher representation (H6) ---------------
// "LR, PCA-4" and "VQC, PCA-4" are the baseline experiments (same values as Table I).
const tableIV: Record<string, Record<string, [number, number]>> = {
  wdbc: { 'encoder-net': [0.992, 0.005], 'lr-on-enc': [0.992, 0.005], 'vqc-on-enc': [0.938, 0.052], 'vqc-on-enc-half': [0.985, 0.011] },
  ionosphere: { 'encoder-net': [0.924, 0.072], 'lr-on-enc': [0.923, 0.074], 'vqc-on-enc': [0.792, 0.197], 'vqc-on-enc-half': [0.912, 0.086] },
  synthetic: { 'encoder-net': [0.673, 0.325], 'lr-on-enc': [0.672, 0.326], 'vqc-on-enc': [0.548, 0.367], 'vqc-on-enc-half': [0.66, 0.336] },
};
const teacherPipelines = {
  'encoder-net': { model: 'Encoder net', family: 'classical', variant: 'Learned features', title: 'Classical encoder network (all features → 8 → 4 tanh units)', desc: 'Classical teacher: all features → 8 → 4 tanh units with its own classical head.' },
  'lr-on-enc': { model: 'LR', family: 'classical', variant: 'On learned features', title: 'Logistic regression on four learned features', desc: 'Logistic regression trained on the four features learned by the classical encoder.' },
  'vqc-on-enc': { model: 'VQC', family: 'hybrid', variant: 'On learned features', title: 'VQC on four learned features', desc: 'VQC trained on the four features learned by the classical encoder, scaled to [−π, π].' },
  'vqc-on-enc-half': { model: 'VQC', family: 'hybrid', variant: 'Learned features, [−π/2, π/2]', title: 'VQC on learned features rescaled to [−π/2, π/2]', desc: '“Half” rescales the learned features to [−π/2, π/2].' },
} as const;
const src4 = `${A}, Table IV`;
for (const ds of A_DATASETS.slice(0, 3)) {
  for (const [key, p] of Object.entries(teacherPipelines)) {
    const [auc, gap] = tableIV[ds.slug]![key]!;
    add({
      slug: `a-teacher-${key}-${ds.slug}`,
      line: LINE_A,
      protocol: 'a-resplits-30',
      dataset: ds.slug,
      title: `${p.title} — ${ds.name}`,
      modelName: p.model,
      modelFamily: p.family,
      variant: p.variant,
      setting: null,
      factor: 'teacher',
      objective:
        'Test whether a representation learned by a classical teacher reduces the gap, and how much of any change comes from the classical encoder rather than the circuit (H6).',
      description: p.desc,
      configuration: { encoder: 'all features → 8 → 4 tanh', ...(key === 'vqc-on-enc-half' ? { angle_range: '[−π/2, π/2]' } : {}) },
      nSeeds: 30,
      nFolds: null,
      observations:
        key === 'vqc-on-enc'
          ? 'The VQC on learned features was much worse than the linear head, partly an encoding artifact: 82% to 99% of the learned values lay in the outer 10% of their range, and [−π, π] maps both ends to the same state.'
          : null,
      limitations: null,
      source: src4,
      metrics: [m('roc_auc', auc, 'test', 'mean_over_seeds', src4), m('gen_gap', gap, null, 'mean_over_seeds', src4)],
    });
  }
}

// --- Line A · label randomization (running text, Baseline paragraph) --------
const shuffled: Array<[AModel, number, number]> = [
  ['VQC', 0.605, 0.671],
  ['MLP', 0.537, 0.651],
  ['RF', 0.959, 1.0],
  ['XGBoost', 0.847, 0.998],
];
for (const [model, lo, hi] of shuffled) {
  const src = `${A}, Section IV-B (Baseline)`;
  add({
    slug: `a-shuffled-labels-${model.toLowerCase()}`,
    line: LINE_A,
    protocol: 'a-resplits-30',
    dataset: null,
    title: `${A_MODELS[model].full} trained on shuffled labels`,
    modelName: model,
    modelFamily: A_MODELS[model].family,
    variant: 'Shuffled labels',
    setting: 'Range across datasets',
    factor: 'memorization',
    objective:
      'Label-randomization control: a model that fits permuted labels can memorize arbitrary data, so a good fit on true labels says little about generalization.',
    description: 'Trained on randomly permuted labels. The manuscript reports the range of training AUC.',
    configuration: { labels: 'randomly permuted' },
    nSeeds: 30,
    nFolds: null,
    observations: null,
    limitations: 'Reported as a range; the manuscript does not give a per-dataset breakdown.',
    source: src,
    metrics: [m('roc_auc', lo, 'train', 'range_min', src), m('roc_auc', hi, 'train', 'range_max', src)],
  });
}

// --- Line B · Table I (+ Manuscript A, Table V): representation comparisons --
const srcB1 = `${B}, Table I`;
const srcA5 = `${A}, Table V`;
const bRep: Array<{
  key: string;
  model: string;
  family: 'quantum' | 'classical' | 'hybrid';
  variant: string;
  title: string;
  desc: string;
  train: number;
  val: number;
  trainLoss: number;
  valLoss: number;
  gap: [number, string];
  brier: number;
}> = [
  { key: 'pca4-vqc', model: 'VQC', family: 'quantum', variant: 'PCA-4', title: 'VQC on four principal components', desc: 'Four fixed principal components fitted per fold, fed to the four-qubit VQC.', train: 0.8328, val: 0.8297, trainLoss: 0.4713, valLoss: 0.4769, gap: [0.003, srcA5], brier: 0.153 },
  { key: 'pca4-lr', model: 'LR', family: 'classical', variant: 'PCA-4', title: 'Logistic regression on four principal components', desc: 'L2-regularized logistic regression (C = 1, with intercept) on the same four components.', train: 0.9498, val: 0.949, trainLoss: 0.2201, valLoss: 0.2286, gap: [0.001, srcA5], brier: 0.062 },
  { key: 'encoder-vqc', model: 'VQC', family: 'hybrid', variant: 'Learned encoder', title: 'Learned encoder with VQC head', desc: 'PCA32 input → jointly trained 32 → 8 → 4 encoder (tanh) → angles π·tanh(z/2) → four-qubit VQC reading Z₃.', train: 0.9993, val: 0.9215, trainLoss: 0.0488, valLoss: 0.2867, gap: [0.0778, `${B}, Section IV-A`], brier: 0.071 },
  { key: 'frozen-encoder-lr', model: 'LR', family: 'hybrid', variant: 'Frozen encoder', title: 'Logistic regression on the frozen quantum-trained encoder', desc: 'Logistic probe fitted after freezing the encoder learned jointly with the VQC.', train: 0.9758, val: 0.9371, trainLoss: 0.1104, valLoss: 0.2819, gap: [0.039, srcA5], brier: 0.068 },
  { key: 'classical-encoder-lr', model: 'LR', family: 'classical', variant: 'Joint classical encoder', title: 'Classical encoder trained jointly with a linear head', desc: 'Separately trained classical encoder with a linear (logistic) head, trained jointly.', train: 1.0, val: 0.9345, trainLoss: 0.0022, valLoss: 0.7585, gap: [0.0655, `${B}, Section IV-A`], brier: 0.082 },
];
for (const r of bRep) {
  add({
    slug: `b-representation-${r.key}`,
    line: LINE_B,
    protocol: 'b-dev-folds',
    dataset: 'tcga-brca',
    title: r.title,
    modelName: r.model,
    modelFamily: r.family,
    variant: r.variant,
    setting: null,
    factor: 'representation',
    objective:
      'Compare a fixed four-component PCA representation with a learned 32 → 4 encoder, using quantum and classical heads.',
    description: r.desc,
    configuration: { optimizer: 'AdamW', learning_rate: 0.01, weight_decay: 0.001, batch_size: 32, epochs_per_stage: 50 },
    nSeeds: 3,
    nFolds: 5,
    observations:
      r.key === 'encoder-vqc'
        ? 'The change from PCA4–VQC includes both the PCA32 input and the learned compression, so it cannot be assigned to one component.'
        : r.key === 'classical-encoder-lr'
          ? 'Essentially perfect training AUC; its train–validation difference (0.0655) approached that of the jointly trained encoder–VQC (0.0778), with substantially worse validation log loss (0.7585).'
          : null,
    limitations: null,
    source: `${srcB1}; ${srcA5}`,
    metrics: [
      m('roc_auc', r.train, 'train', 'mean_over_folds_and_seeds', srcB1),
      m('roc_auc', r.val, 'validation', 'mean_over_folds_and_seeds', srcB1),
      m('log_loss', r.trainLoss, 'train', 'mean_over_folds_and_seeds', srcB1, 'nats'),
      m('log_loss', r.valLoss, 'validation', 'mean_over_folds_and_seeds', srcB1, 'nats'),
      m('gen_gap', r.gap[0], null, 'mean_over_folds_and_seeds', r.gap[1]),
      m('brier', r.brier, 'validation', 'mean_over_folds_and_seeds', srcA5),
    ],
  });
}

// --- Line B · Table II: readout and coordinate checks -----------------------
const srcB2 = `${B}, Table II`;
const bReadout = [
  { key: 'original-vqc', model: 'VQC', family: 'hybrid', variant: 'Original head', title: 'Original VQC head on frozen learned embeddings', desc: 'Quantum head as trained jointly with each of the fifteen encoders.', train: 0.999307, val: 0.921474, valLoss: 0.286672 },
  { key: 'refitted-vqc', model: 'VQC', family: 'hybrid', variant: 'Re-fitted head', title: 'Re-fitted VQC head (three initializations per encoder)', desc: 'Quantum head retrained from three initializations on each frozen encoder.', train: 0.999291, val: 0.921837, valLoss: 0.28629 },
  { key: 'lr-latent', model: 'LR', family: 'hybrid', variant: 'Latent z', title: 'Logistic regression on the untransformed latent z', desc: 'Coordinate control: logistic regression on the latent embedding before the angular map.', train: 0.975782, val: 0.937141, valLoss: 0.281925 },
  { key: 'lr-angles', model: 'LR', family: 'hybrid', variant: 'Angles', title: 'Logistic regression on the encoding angles', desc: 'Coordinate control: logistic regression on π·tanh(z/2).', train: 0.977958, val: 0.937073, valLoss: 0.283954 },
] as const;
for (const r of bReadout) {
  add({
    slug: `b-readout-${r.key}`,
    line: LINE_B,
    protocol: 'b-dev-folds',
    dataset: 'tcga-brca',
    title: r.title,
    modelName: r.model,
    modelFamily: r.family,
    variant: r.variant,
    setting: null,
    factor: 'readout',
    objective:
      'Check whether retraining the quantum head or removing the angular map changes the readout comparison on frozen learned embeddings.',
    description: r.desc,
    configuration: { encoders: 15, frozen: true },
    nSeeds: 3,
    nFolds: 5,
    observations:
      r.key === 'refitted-vqc'
        ? 'Retraining did not produce a substantial average rescue at the recorded budget.'
        : r.key === 'lr-angles'
          ? 'The angular map did not materially change the ranking comparison.'
          : null,
    limitations:
      'Neither control proves optimal quantum fitting, and neither was performed on the later quantum-fidelity-trained encoders.',
    source: srcB2,
    metrics: [
      m('roc_auc', r.train, 'train', 'mean_over_folds_and_seeds', srcB2),
      m('roc_auc', r.val, 'validation', 'mean_over_folds_and_seeds', srcB2),
      m('log_loss', r.valLoss, 'validation', 'mean_over_folds_and_seeds', srcB2, 'nats'),
    ],
  });
}

// --- Line B · Table III: pairwise geometry objectives and schedules ---------
const srcB3 = `${B}, Table III`;
const bGeom = [
  { key: 'nqe-q', variant: 'NQE-Q', title: 'Staged neural quantum embedding, fidelity similarity (NQE-Q)', desc: '50 epochs of pairwise geometry training with quantum product-state fidelity k_Q, then 50 epochs of VQC classifier fitting.', train: 0.99796, val: 0.93003, valLoss: 0.29577, ba: 0.81752, schedule: 'staged', kernel: 'quantum fidelity' },
  { key: 'nqe-e', variant: 'NQE-E', title: 'Staged neural quantum embedding, Gaussian similarity (NQE-E)', desc: '50 epochs of pairwise geometry training with Gaussian similarity k_E, then 50 epochs of VQC classifier fitting.', train: 0.9982, val: 0.91493, valLoss: 0.30627, ba: 0.81064, schedule: 'staged', kernel: 'Gaussian' },
  { key: 'hybrid-q', variant: 'Hybrid-Q', title: 'Joint geometry and classification, fidelity similarity (Hybrid-Q)', desc: 'Geometry and classification optimized jointly for 50 epochs with fidelity similarity.', train: 0.99971, val: 0.90631, valLoss: 0.34071, ba: 0.8495, schedule: 'joint', kernel: 'quantum fidelity' },
  { key: 'hybrid-e', variant: 'Hybrid-E', title: 'Joint geometry and classification, Gaussian similarity (Hybrid-E)', desc: 'Geometry and classification optimized jointly for 50 epochs with Gaussian similarity.', train: 0.9997, val: 0.9154, valLoss: 0.31977, ba: 0.83985, schedule: 'joint', kernel: 'Gaussian' },
] as const;
for (const r of bGeom) {
  const metrics = [
    m('roc_auc', r.train, 'train', 'mean_over_folds_and_seeds', srcB3),
    m('roc_auc', r.val, 'validation', 'mean_over_folds_and_seeds', srcB3),
    m('log_loss', r.valLoss, 'validation', 'mean_over_folds_and_seeds', srcB3, 'nats'),
    m('balanced_accuracy', r.ba, 'validation', 'mean_over_folds_and_seeds', srcB3),
  ];
  if (r.key === 'nqe-q') {
    metrics.push(
      m('recall_minority', 0.6702, 'validation', 'mean_over_folds_and_seeds', `${B}, Section IV-D`),
      m('geometry_ratio', 0.9863, null, 'mean_over_folds_and_seeds', `${B}, Section IV-C`),
    );
  }
  add({
    slug: `b-geometry-${r.key}`,
    line: LINE_B,
    protocol: 'b-dev-folds',
    dataset: 'tcga-brca',
    title: r.title,
    modelName: 'VQC',
    modelFamily: 'hybrid',
    variant: r.variant,
    setting: null,
    factor: 'geometry',
    objective: 'Test whether supervised pair geometry in the embedding improves downstream classification.',
    description: r.desc,
    configuration: { schedule: r.schedule, similarity: r.kernel, pairs_per_update: '16 ER+/ER+, 16 ER−/ER−, 32 cross-class' },
    nSeeds: 3,
    nFolds: 5,
    observations:
      r.key === 'nqe-q'
        ? 'Exposed a sharper readout discrepancy: logistic regression on the same frozen embedding reached a higher validation AUC (see the same-embedding readout comparison).'
        : null,
    limitations:
      'Staged and joint procedures use different total update budgets and expose the encoder to different gradients, so this comparison does not isolate a schedule effect. k_Q is classically computable for the product-RY encoding; no quantum computational advantage is implied.',
    source: srcB3,
    metrics,
  });
}

// --- Line B · Section IV-D: same-embedding readout comparison ---------------
add({
  slug: 'b-same-embedding-lr-z',
  line: LINE_B,
  protocol: 'b-dev-folds',
  dataset: 'tcga-brca',
  title: 'Logistic regression on the frozen NQE-Q embedding',
  modelName: 'LR',
  modelFamily: 'hybrid',
  variant: 'Frozen NQE-Q embedding',
  setting: null,
  factor: 'readout',
  objective:
    'Compare a quantum readout and a logistic readout fitted on the same frozen four-dimensional embedding (staged quantum-fidelity training).',
  description:
    'Logistic regression fitted on the same frozen four-dimensional embedding used by the NQE-Q VQC readout. The values come from a retrospective analysis that reused stored probabilities.',
  configuration: { embedding: 'NQE-Q (staged fidelity)', frozen: true },
  nSeeds: 3,
  nFolds: 5,
  observations:
    'LR improved validation AUC in 10 of 15 paired fold–seed cells, but the 15 cells do not represent independent patients or independent confirmation.',
  limitations:
    'The VQC and LR differ in function family, output intercept and scale, optimizer and regularization. Equal coordinates do not make this a parameter-matched causal comparison. No significance test is claimed.',
  source: `${B}, Section IV-D`,
  metrics: [
    m('roc_auc', 0.968277, 'train', 'mean_over_folds_and_seeds', `${B}, Section IV-D`),
    m('roc_auc', 0.94152, 'validation', 'mean_over_folds_and_seeds', `${B}, Section IV-D`),
    m('log_loss', 0.25597, 'validation', 'mean_over_folds_and_seeds', `${B}, Section IV-D`, 'nats'),
    m('recall_minority', 0.7789, 'validation', 'mean_over_folds_and_seeds', `${B}, Section IV-D`),
  ],
});

// --- Line B · Fig. 3 and Fig. 4 fold-level paired differences ---------------
const foldDiffs: Array<{
  key: string;
  model: string;
  variant: string;
  title: string;
  sign: string;
  values: number[];
  figure: string;
  factor: 'readout' | 'geometry';
  mean?: number;
  sd?: number;
}> = [
  {
    key: 'readout-lr-minus-vqc',
    model: 'LR − VQC',
    variant: 'Same NQE-Q embedding',
    title: 'Readout difference on the same embedding (LR on z minus VQC)',
    sign: 'Positive values favor logistic regression on the frozen embedding.',
    values: [0.012, 0.012, 0.009, 0.035, -0.011],
    figure: `${B}, Fig. 4 (data labels)`,
    factor: 'readout',
    mean: 0.01149,
    sd: 0.01638,
  },
  {
    key: 'nqe-fidelity-minus-gaussian',
    model: 'NQE: Q − E',
    variant: 'Staged schedule',
    title: 'Fidelity minus Gaussian geometry, staged schedule (NQE)',
    sign: 'Positive values favor quantum-fidelity similarity.',
    values: [0.001, 0.023, 0.014, 0.003, 0.034],
    figure: `${B}, Fig. 3 (data labels)`,
    factor: 'geometry',
  },
  {
    key: 'hybrid-fidelity-minus-gaussian',
    model: 'Hybrid: Q − E',
    variant: 'Joint schedule',
    title: 'Fidelity minus Gaussian geometry, joint schedule (Hybrid)',
    sign: 'Positive values favor quantum-fidelity similarity.',
    values: [-0.019, -0.011, -0.023, -0.002, 0.009],
    figure: `${B}, Fig. 3 (data labels)`,
    factor: 'geometry',
  },
];
for (const d of foldDiffs) {
  d.values.forEach((v, fold) => {
    add({
      slug: `b-fold-${d.key}-f${fold}`,
      line: LINE_B,
      protocol: 'b-dev-folds',
      dataset: 'tcga-brca',
      title: `${d.title}, fold ${fold}`,
      modelName: d.model,
      modelFamily: 'hybrid',
      variant: d.variant,
      setting: `Fold ${fold}`,
      factor: d.factor,
      objective: 'Show how a paired validation AUC difference varies across development folds.',
      description: `${d.sign} Seed-averaged paired difference within development fold ${fold}.`,
      configuration: null,
      fold,
      nSeeds: 3,
      nFolds: 5,
      observations: null,
      limitations: 'Folds reuse the same 835 development patients; this is descriptive variation, not a confidence interval.',
      source: d.figure,
      metrics: [m('auc_difference', v, 'validation', 'fold_mean_over_seeds', d.figure)],
    });
  });
  if (d.mean !== undefined && d.sd !== undefined) {
    add({
      slug: `b-fold-${d.key}-mean`,
      line: LINE_B,
      protocol: 'b-dev-folds',
      dataset: 'tcga-brca',
      title: `${d.title}, mean across folds`,
      modelName: d.model,
      modelFamily: 'hybrid',
      variant: d.variant,
      setting: 'Mean of folds',
      factor: d.factor,
      objective: 'Summarize the paired readout difference across the five development folds.',
      description: `${d.sign} Mean of the five fold means and the standard deviation between them.`,
      configuration: null,
      nSeeds: 3,
      nFolds: 5,
      observations: 'Fold 4 reversed the advantage.',
      limitations:
        'The standard deviation between fold means describes variation among reused partitions; it is not a confidence interval. The small mean difference and the reversed fold temper any claim of readout superiority.',
      source: `${B}, Section IV-D`,
      metrics: [
        m('auc_difference', d.mean, 'validation', 'mean_over_folds_and_seeds', `${B}, Section IV-D`),
        m('auc_difference', d.sd, 'validation', 'std_between_fold_means', `${B}, Section IV-D`),
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// Comparison sets (curated groups of protocol-compatible experiments)
// ---------------------------------------------------------------------------

const slugsWhere = (pred: (e: SeedExperiment) => boolean) => experiments.filter(pred).map((e) => e.slug);
const baselineFor = (models: AModel[], datasets: readonly string[] = A_DATASETS.map((d) => d.slug)) =>
  datasets.flatMap((ds) => models.map((mdl) => baselineSlug(ds, mdl)));

const comparisonSets = [
  {
    slug: 'a-baseline',
    line: LINE_A,
    protocol: 'a-resplits-30',
    factor: 'baseline',
    name: 'Baseline: same four inputs',
    rowLabel: 'Dataset',
    description: 'The VQC and five classical models with the same four inputs on four datasets (Table I).',
    experiments: slugsWhere((e) => e.factor === 'baseline'),
  },
  {
    slug: 'a-capacity',
    line: LINE_A,
    protocol: 'a-resplits-30',
    factor: 'capacity_readout',
    name: 'Capacity & readout (H3)',
    rowLabel: 'Dataset',
    description:
      'VQC depth, entanglement and readout variants against parameter-matched MLPs, 200 epochs (Table III). Base rows are the baseline experiments.',
    experiments: [...baselineFor(['VQC', 'MLP']), ...slugsWhere((e) => e.factor === 'capacity_readout')],
  },
  {
    slug: 'a-training-size',
    line: LINE_A,
    protocol: 'a-resplits-30',
    factor: 'training_size',
    name: 'Training-set size (H4)',
    rowLabel: 'Dataset',
    description: 'VQC gap with 10% versus 100% (baseline) of the training split. Only values stated in the text are included.',
    experiments: [...baselineFor(['VQC']), ...slugsWhere((e) => e.factor === 'training_size')],
  },
  {
    slug: 'a-optimization',
    line: LINE_A,
    protocol: 'a-resplits-30',
    factor: 'optimization',
    name: 'Optimization budget (H5)',
    rowLabel: 'Dataset',
    description: 'VQC gap after 25, 200 (baseline) and 800 epochs.',
    experiments: [...baselineFor(['VQC']), ...slugsWhere((e) => e.factor === 'optimization')],
  },
  {
    slug: 'a-teacher',
    line: LINE_A,
    protocol: 'a-resplits-30',
    factor: 'teacher',
    name: 'Classical teacher representation (H6)',
    rowLabel: 'Dataset',
    description:
      'Heads on four principal components (baseline) and on four features learned by a classical encoder (Table IV). Blood Transfusion was not part of this experiment.',
    experiments: [
      ...baselineFor(['LR', 'VQC'], ['wdbc', 'ionosphere', 'synthetic']),
      ...slugsWhere((e) => e.factor === 'teacher'),
    ],
  },
  {
    slug: 'a-shuffled-labels',
    line: LINE_A,
    protocol: 'a-resplits-30',
    factor: 'memorization',
    name: 'Label randomization',
    rowLabel: 'Setting',
    description: 'Training AUC reached on randomly permuted labels (reported ranges).',
    experiments: slugsWhere((e) => e.factor === 'memorization'),
  },
  {
    slug: 'a-encoding',
    line: LINE_A,
    protocol: 'a-frequency-tasks',
    factor: 'encoding',
    name: 'Encoding vs target frequency (H2)',
    rowLabel: 'Task',
    description: 'Single upload, re-uploading and doubled angles on synthetic frequency tasks, with an MLP comparator (Table II).',
    experiments: slugsWhere((e) => e.factor === 'encoding'),
  },
  {
    slug: 'b-representation',
    line: LINE_B,
    protocol: 'b-dev-folds',
    factor: 'representation',
    name: 'Learned representations',
    rowLabel: 'Dataset',
    description: 'PCA-4 and learned-encoder pipelines with quantum and logistic heads (Manuscript B Table I; gap and Brier from Manuscript A Table V).',
    experiments: slugsWhere((e) => e.factor === 'representation'),
  },
  {
    slug: 'b-readout-controls',
    line: LINE_B,
    protocol: 'b-dev-folds',
    factor: 'readout',
    name: 'Readout & coordinate controls',
    rowLabel: 'Dataset',
    description: 'Frozen learned embeddings: original and re-fitted VQC heads, logistic regression on latent z and on angles (Table II).',
    experiments: slugsWhere((e) => e.slug.startsWith('b-readout-')),
  },
  {
    slug: 'b-geometry',
    line: LINE_B,
    protocol: 'b-dev-folds',
    factor: 'geometry',
    name: 'Geometry objectives & schedules',
    rowLabel: 'Dataset',
    description: 'Fidelity versus Gaussian pair objectives under staged and joint schedules (Table III).',
    experiments: slugsWhere((e) => e.slug.startsWith('b-geometry-')),
  },
  {
    slug: 'b-same-embedding',
    line: LINE_B,
    protocol: 'b-dev-folds',
    factor: 'readout',
    name: 'Same-embedding readouts',
    rowLabel: 'Dataset',
    description: 'Quantum (NQE-Q VQC) and logistic readouts fitted on the identical frozen staged-fidelity embedding (Section IV-D).',
    experiments: ['b-geometry-nqe-q', 'b-same-embedding-lr-z'],
  },
  {
    slug: 'b-fold-differences',
    line: LINE_B,
    protocol: 'b-dev-folds',
    factor: 'readout',
    name: 'Fold-level paired differences',
    rowLabel: 'Fold',
    description: 'Seed-averaged paired validation AUC differences per development fold (Fig. 3 and Fig. 4 data labels).',
    experiments: slugsWhere((e) => e.slug.startsWith('b-fold-')),
  },
].map((s, i) => ({ ...s, sortOrder: i }));

for (const s of comparisonSets) {
  for (const slug of s.experiments) {
    if (!experiments.some((e) => e.slug === slug)) throw new Error(`set ${s.slug}: unknown ${slug}`);
  }
}

// ---------------------------------------------------------------------------
// Cross-line evidence synthesis (curated by the researchers, not generated)
// ---------------------------------------------------------------------------

const questions = [
  {
    slug: 'input-representation',
    question: 'Does input representation influence VQC generalization?',
    context:
      'Four qubits force the input down to four numbers. Both lines changed how those numbers are produced while keeping the circuit fixed.',
    agreement: 'converging',
    openQuestions:
      'How much of the learned-encoder improvement comes from the PCA32 input versus the learned compression remains unattributed.',
    findings: [
      {
        line: LINE_A,
        observation:
          'Reducing to four components cost the classical models up to 0.066 test AUC on Ionosphere (SVM) and 0.186 on the synthetic data (XGBoost). Replacing the components by the four features with the highest F-value raised the VQC test AUC on Ionosphere by 0.040 and lowered it on the synthetic data by 0.047.',
        interpretation:
          'The choice of reduction changes the sign of the VQC–MLP difference on Ionosphere (−0.033 to +0.010), so the representation is part of what a reported gap measures. Verdict for H1: partially supported.',
        limitations: 'Intervals are uncorrected and seeds are re-splits of the same data.',
        experiments: baselineFor(['VQC', 'MLP', 'SVM'], ['ionosphere', 'synthetic']),
      },
      {
        line: LINE_B,
        observation:
          'A learned encoder raised the VQC validation AUC from 0.8297 (four fixed principal components) to 0.9215, while training AUC rose to 0.9993. Logistic regression on the frozen quantum-trained encoder reached 0.9371, and logistic regression on four principal components 0.9490.',
        interpretation:
          'Representation learning improved the VQC, but simpler classical readouts on the same or simpler inputs remained competitive.',
        limitations:
          'The change includes both the PCA32 input and the learned compression, so it cannot be assigned to one component.',
        experiments: ['b-representation-pca4-vqc', 'b-representation-encoder-vqc', 'b-representation-frozen-encoder-lr', 'b-representation-pca4-lr'],
      },
    ],
  },
  {
    slug: 'fit-vs-generalization',
    question: 'Does better training fit imply better generalization?',
    context: 'Both lines report training and held-out AUC for the same pipelines, so fit and generalization can be read side by side.',
    agreement: 'converging',
    openQuestions: 'Whether the train–validation divergence is driven by the encoder, the readout or the fitting budget is not separated in either line.',
    findings: [
      {
        line: LINE_A,
        observation:
          'Between 25 and 800 epochs the VQC gap rose on every dataset, as it did for the MLP; going from 200 to 800 epochs raised the gap on the synthetic data and Blood Transfusion without improving test AUC. With shuffled labels the VQC reached a training AUC of 0.605–0.671, like the MLP (0.537–0.651), while Random Forest (0.959–1.000) and XGBoost (0.847–0.998) memorized them almost perfectly.',
        interpretation: 'A longer fit increases the gap for every model; the VQC can memorize random labels, but far less than tree ensembles.',
        limitations: 'Learning rate and epochs were fixed once and shared by the VQC and the MLP.',
        experiments: [
          ...slugsWhere((e) => e.factor === 'optimization'),
          ...slugsWhere((e) => e.factor === 'memorization'),
        ],
      },
      {
        line: LINE_B,
        observation:
          'With staged quantum-fidelity training, the VQC reached 0.9980 training AUC and 0.9300 validation AUC; logistic regression on identical frozen coordinates reached 0.9683 and 0.9415. The mean validation advantage of 0.0115 varied across folds and reversed in fold 4.',
        interpretation: 'A higher training fit coexisted with a lower validation ranking than a classical readout on the same coordinates.',
        limitations:
          'The VQC and LR differ in function family, intercept and scale, optimizer and regularization; this is not a parameter-matched causal comparison.',
        experiments: ['b-geometry-nqe-q', 'b-same-embedding-lr-z', 'b-fold-readout-lr-minus-vqc-mean'],
      },
    ],
  },
  {
    slug: 'classical-teacher',
    question: 'Does a learned classical representation reduce the gap?',
    context: 'Line A tested a classical teacher as an intervention; Line B trained encoders jointly with quantum and classical heads.',
    agreement: 'converging',
    openQuestions: 'Knowledge distillation was not trained in Line B and would require a fresh prespecified evaluation.',
    findings: [
      {
        line: LINE_A,
        observation:
          'Soft labels from an RBF-SVM teacher reduced the VQC gap by only 0.001 to 0.010 without significantly raising test AUC. A learned classical representation increased the gap; the logistic head on the learned features had a gap larger than on principal components by 0.063 (Ionosphere) and 0.315 (synthetic).',
        interpretation:
          'Almost all of the increase came from the classical encoder rather than the circuit. Verdict for H6: not supported.',
        limitations: 'The teacher was a single model of each kind.',
        experiments: slugsWhere((e) => e.factor === 'teacher'),
      },
      {
        line: LINE_B,
        observation:
          'A separately trained classical encoder with a linear head reached essentially perfect training AUC and a train–validation difference of 0.0655, close to the 0.0778 of the jointly trained encoder–VQC.',
        interpretation: 'The encoder and its training procedure are plausible contributors to the divergence.',
        limitations:
          'The two models learned different embeddings, so this does not apportion responsibility between encoder and circuit.',
        experiments: ['b-representation-classical-encoder-lr', 'b-representation-encoder-vqc'],
      },
    ],
  },
  {
    slug: 'circuit-specific',
    question: 'Is the gap a property specific to the quantum circuit?',
    context: 'Line A varied the circuit directly; Line B analyzed which functions the implemented circuit can express.',
    agreement: 'mixed',
    openQuestions:
      'No link between the functional restrictions of the readout and the observed AUC gap has been established. A probe with free angular-basis coefficients would change several things at once.',
    findings: [
      {
        line: LINE_A,
        observation:
          'With the full training split, the VQC gap was at most 0.015 larger than that of an MLP with a similar number of parameters, smaller than that of the tree ensembles and larger than that of logistic regression. Removing entanglement did not change test AUC clearly, but reduced the gap and the effective parameters (12 → 8). Four layers matched an equal-size MLP.',
        interpretation:
          'The gap is interpreted as a consequence of effective capacity, data requirements and input representation, not of a property specific to quantum circuits.',
        limitations: 'Noise-free simulation, four qubits, one circuit family, four datasets.',
        experiments: [...baselineFor(['VQC', 'MLP']), ...slugsWhere((e) => e.factor === 'capacity_readout' && e.variant === 'No entanglement')],
      },
      {
        line: LINE_B,
        observation:
          'An analysis of the implemented circuit finds 81 candidate angular basis functions in the encoding envelope, a 62-function linear span under the chosen ansatz, and at most 12 functionally relevant continuous parameter directions.',
        interpretation: 'These restrictions are a concrete candidate for future work.',
        limitations: 'It is a structural result, not a demonstrated mechanism for the observed discrepancy.',
        experiments: [],
      },
    ],
  },
  {
    slug: 'readout-choice',
    question: 'Does the choice of readout change generalization?',
    context: 'Both lines swapped the head while keeping the inputs fixed.',
    agreement: 'mixed',
    openQuestions: 'A genuinely matched readout protocol is still needed to separate fitting effects from readout restrictions.',
    findings: [
      {
        line: LINE_A,
        observation:
          'A fixed-sum readout lowered AUC on WDBC and Ionosphere and reduced the gap on all datasets. On features learned by a classical encoder, a linear head did as much as the circuit.',
        interpretation: 'Readout capacity moves the gap together with effective parameters.',
        limitations: 'Intervals uncorrected; four datasets.',
        experiments: slugsWhere((e) => e.factor === 'capacity_readout' && e.variant === 'Fixed-sum readout'),
      },
      {
        line: LINE_B,
        observation:
          'On the staged-fidelity embedding, validation log loss was 0.29577 for the VQC and 0.25597 for LR, with much of the difference arising among ER− patients; ER− recall was 0.6702 with the VQC and 0.7789 with LR. Re-fitting the VQC head from three initializations did not change mean validation AUC materially (0.921474 → 0.921837).',
        interpretation:
          'Score calibration alone cannot account for the AUC difference, although fitting the probability link may still affect log loss or fixed-threshold decisions.',
        limitations: 'Optimizer, output link and regularization are not matched between readouts.',
        experiments: ['b-geometry-nqe-q', 'b-same-embedding-lr-z', 'b-readout-original-vqc', 'b-readout-refitted-vqc'],
      },
    ],
  },
  {
    slug: 'geometry',
    question: 'Does supervised embedding geometry translate into better classification?',
    context: 'Only Line B studied pairwise geometry objectives; Line A provides no direct evidence on this question.',
    agreement: 'open',
    openQuestions: 'Line A has no corresponding experiment. Class-mean contrast and individual ranking answer different questions.',
    findings: [
      {
        line: LINE_B,
        observation:
          'Under the staged schedule, quantum-fidelity geometry yielded validation AUC 0.9300 against 0.9149 with Gaussian similarity; under joint fitting the ordering reversed (0.9063 against 0.9154). The mean quantum-geometry ratio |J|/D_tr was 0.9863 for the staged fidelity model, and some variants had greater trace distance yet worse validation AUC and log loss.',
        interpretation: 'Geometric improvements did not consistently carry over to classification.',
        limitations: 'Staged and joint procedures use different total update budgets, so the comparison does not isolate a schedule effect.',
        experiments: [...slugsWhere((e) => e.slug.startsWith('b-geometry-')), 'b-fold-nqe-fidelity-minus-gaussian-f4'],
      },
    ],
  },
].map((q, i) => ({
  ...q,
  status: 'published',
  sortOrder: i,
  findings: q.findings.map((f, j) => ({ ...f, status: 'published', sortOrder: j })),
}));

for (const q of questions) {
  for (const f of q.findings) {
    for (const slug of f.experiments) {
      if (!experiments.some((e) => e.slug === slug)) throw new Error(`finding ${q.slug}: unknown ${slug}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Figures extracted from the manuscripts (images live in data/figures/)
// ---------------------------------------------------------------------------

const figures = [
  { file: 'a-fig1-circuit.png', line: LINE_A, experiment: baselineSlug('wdbc', 'VQC'), title: 'Four-qubit VQC', description: 'Four-qubit VQC: angle encoding, two variational layers with entangling gates, and measurement.', source: `${A}, Fig. 1` },
  { file: 'a-fig2-pipeline.png', line: LINE_A, experiment: baselineSlug('wdbc', 'LR'), title: 'Experimental pipeline', description: 'Preprocessing fitted on the training split only, the VQC and the classical comparators on the same four inputs, and the metrics computed on both splits.', source: `${A}, Fig. 2` },
  { file: 'a-fig3-training-size.png', line: LINE_A, experiment: 'a-training-size-vqc-10pct-wdbc', title: 'Test AUC and gap versus training data used', description: 'Test AUC (top) and gap (bottom) as a function of the percentage of the training split used (means over 30 seeds).', source: `${A}, Fig. 3` },
  { file: 'b-fig1-shared-embedding.png', line: LINE_B, experiment: 'b-representation-frozen-encoder-lr', title: 'Shared-embedding comparison', description: 'The shared-embedding comparison fits logistic regression after freezing a representation learned with the VQC. Equal input coordinates do not imply equal model capacity or fitting. PCA4 also feeds separate VQC and classical baselines.', source: `${B}, Fig. 1` },
  { file: 'b-fig2-representations.png', line: LINE_B, experiment: 'b-representation-encoder-vqc', title: 'Learned representations and generalization', description: 'Training and validation ROC-AUC for the PCA4 quantum and logistic baselines, the jointly learned encoder–VQC, and logistic regression on the frozen quantum-trained embedding. AUC means are aggregated fold-first. Different encoder inputs and fits prevent an attribution of the improvement to the quantum circuit alone.', source: `${B}, Fig. 2` },
  { file: 'b-fig3-geometry.png', line: LINE_B, experiment: 'b-geometry-nqe-q', title: 'Geometric objective and training schedule', description: 'Development AUC with two geometry objectives and two fitting schedules. The lower panel shows paired fidelity-minus-Gaussian validation differences within each fold, averaged across seeds. Positive values favor fidelity; the schedule comparison is confounded by training budget and optimization.', source: `${B}, Fig. 3` },
  { file: 'b-fig4-readout.png', line: LINE_B, experiment: 'b-same-embedding-lr-z', title: 'Same-embedding readout comparison', description: 'The top panel contrasts mean training and validation AUC. The bottom panel gives fold-level validation differences, LR on frozen z minus VQC, averaged over three seeds. The reversed fifth fold and the small mean difference temper any claim of readout superiority.', source: `${B}, Fig. 4` },
];

// ---------------------------------------------------------------------------

const write = (name: string, data: unknown) =>
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + '\n');

write('research-lines.json', researchLines);
write('datasets.json', datasets);
write('protocols.json', protocols);
write('comparison-sets.json', comparisonSets);
write(
  'experiments.json',
  experiments.map(({ metrics: _m, ...e }) => e),
);
write(
  'metrics.json',
  experiments.flatMap((e) => e.metrics.map((mt) => ({ experiment: e.slug, ...mt }))),
);
write('findings.json', questions);
write('figures.json', figures);

const metricCount = experiments.reduce((n, e) => n + e.metrics.length, 0);
console.log(
  `seed: ${experiments.length} experiments, ${metricCount} metrics, ${comparisonSets.length} comparison sets, ${questions.length} questions, ${figures.length} figures`,
);
