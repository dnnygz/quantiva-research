# Seed data — provenance

`build.ts` is the single source of the initial data. Run `npm run seed:build` to regenerate the JSON files, then
`npm run db:seed -w @qa/api` to load them into PostgreSQL (idempotent upsert by slug).

| Source | Stored as |
| --- | --- |
| Manuscript A, Table I (baseline, 4 datasets × 6 models) | `a-baseline-*` · test ROC-AUC + gap, mean over 30 seeds |
| Manuscript A, Table II (encoding H2, frequency tasks) | `a-encoding-*` · gap only where reported (VQC, MLP) |
| Manuscript A, Table III (capacity & readout H3) | `a-capacity-*` + parameter counts on the baseline VQC/MLP rows |
| Manuscript A, Section IV-B text (H4, H5, label randomization) | `a-training-size-*`, `a-optimization-*`, `a-shuffled-labels-*` (ranges as `range_min`/`range_max`) |
| Manuscript A, Table IV (teacher H6) | `a-teacher-*`; the PCA-4 columns are the baseline experiments (linked, not duplicated) |
| Manuscript B, Table I + Manuscript A, Table V (same TCGA-BRCA pipelines) | `b-representation-*`; each metric keeps its own `source` |
| Manuscript B, Tables II–III, Section IV-C/D | `b-readout-*`, `b-geometry-*`, `b-same-embedding-lr-z` |
| Manuscript B, Fig. 3 and Fig. 4 printed data labels | `b-fold-*` fold-level paired differences |
| Figures | cropped from the manuscripts into `data/figures/`, captions copied verbatim |

Rules applied:

- Values are transcribed exactly; nothing is derived, interpolated or synthesized. Train AUC for Line A is **not** stored
  (the manuscript reports test AUC and gap only).
- Intermediate points of Manuscript A Fig. 3 are not tabulated, so they are not stored; only the figure is shown.
- No per-epoch training histories exist in the manuscripts, so no training curve is seeded.
- The 209 locked-test TCGA-BRCA patients are not part of any result.
- The example row “Balanced accuracy · Validation · 0.8815” from the product brief does not appear in either manuscript
  and was not used. Balanced accuracy is only reported in Manuscript B, Table III.
- Cross-line findings (`findings.json`) were written from the manuscripts' own statements and must be reviewed by the
  researchers before the final paper; they can be edited in Admin → Findings.
