import { Link } from 'react-router';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Compass,
  Cpu,
  GitCompareArrows,
  Layers,
  Scale,
  Sparkles,
} from 'lucide-react';
import { FACTOR_LABELS, type Factor } from '@qa/shared';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/aero/glass-card';
import { BubbleField } from '@/components/aero/bubbles';
import { BlochOrb } from '@/components/aero/bloch-orb';
import { SectionHeader } from '@/components/layout/page-header';
import { AgreementBadge, LineBadge } from '@/components/science/badges';
import { useResearch } from '@/hooks/research-data';
import { firstSentence } from '@/lib/text';

const PRIMER = [
  {
    icon: <Cpu />,
    title: 'What is a VQC?',
    body: 'A variational quantum classifier encodes a few input numbers as qubit rotations, applies a trainable circuit, measures it, and maps the outcome to a class probability.',
  },
  {
    icon: <Scale />,
    title: 'What is generalization?',
    body: 'How well a model ranks new samples compared with the ones it was trained on. Here the gap is training AUC minus held-out AUC.',
  },
  {
    icon: <GitCompareArrows />,
    title: 'Why compare with classical models?',
    body: 'A gap only means something next to models that receive the same inputs, comparable capacity and the same budget.',
  },
  {
    icon: <Compass />,
    title: 'What do we ask?',
    body: 'Under which conditions VQCs generalize differently, and what role representation, architecture, training and readout play.',
  },
];

export default function OverviewPage() {
  const data = useResearch();
  const lines = data.catalog.researchLines;
  const datasetCount = new Set(data.experiments.map((e) => e.datasetId).filter((d) => d != null)).size;

  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="relative mt-6 sm:mt-8">
        <GlassCard gloss className="relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16 lg:py-20">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(120deg,rgb(169_222_255/0.45)_0%,rgb(114_215_232/0.25)_38%,rgb(168_230_207/0.3)_70%,rgb(216_204_255/0.35)_100%)]" />
          <BubbleField preset="hero" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.25fr_1fr]">
            <div className="animate-rise">
              <p className="eyebrow mb-4 flex items-center gap-2">
                <Sparkles className="size-3.5 text-primary-600" /> One research project · two lines of evidence
              </p>
              <h1 className="text-[2.4rem] leading-[1.05] font-extrabold sm:text-6xl">
                Understanding{' '}
                <span className="bg-gradient-to-r from-[#0a7396] via-[#1a9cb8] to-[#6a4fc2] bg-clip-text text-transparent">
                  quantum generalization
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
                An interactive exploration of representations, training conditions, and readout behavior in
                variational quantum classifiers.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="aero" size="lg">
                  <Link to="/explore">
                    Explore results <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="glass" size="lg">
                  <Link to="/compare">Compare models</Link>
                </Button>
              </div>
              <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                {[
                  [String(lines.length), 'research lines'],
                  [String(datasetCount), 'datasets'],
                  [String(data.experiments.length), 'published results'],
                  ['4', 'qubits, noise-free simulation'],
                ].map(([v, l]) => (
                  <div key={l} className="flex items-baseline gap-2">
                    <dt className="order-2 text-ink-3">{l}</dt>
                    <dd className="tabular order-1 text-2xl font-bold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative mx-auto hidden w-full max-w-[380px] sm:block">
              <BlochOrb className="w-full drop-shadow-[0_30px_40px_rgb(23_50_77/0.12)] motion-safe:animate-float-slower" />
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Research overview */}
      <section className="mt-16" aria-labelledby="primer">
        <SectionHeader
          id="primer"
          title="The research in four questions"
          description="We do not set out to show that quantum classifiers beat classical ones. We study, under controlled conditions, when and why their generalization differs."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRIMER.map((p, i) => (
            <div
              key={p.title}
              className="glass rounded-3xl p-5 transition-transform duration-300 hover:-translate-y-0.5 animate-rise"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-white to-[#d9f1fb] text-primary-600 shadow-soft ring-1 ring-white [&_svg]:size-5">
                {p.icon}
              </span>
              <h3 className="mt-4 text-[1.02rem] font-bold">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Experimental lines */}
      <section className="mt-16" aria-labelledby="lines">
        <SectionHeader
          id="lines"
          icon={<Layers />}
          title="Experimental lines"
          description="Two complementary lines of evidence that will be synthesized into a single manuscript. Their protocols differ, so their numbers are compared qualitatively."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          {lines.map((line) => {
            const exps = data.experiments.filter((e) => e.researchLineId === line.id);
            const factors = [...new Set(exps.map((e) => e.factor))] as Factor[];
            const protocols = data.catalog.protocols.filter((p) => p.researchLineId === line.id);
            const dsNames = [
              ...new Set(exps.map((e) => (e.datasetId != null ? data.datasets.get(e.datasetId)?.shortName : null))),
            ].filter(Boolean);
            return (
              <Link
                key={line.id}
                to={`/explore?line=${line.slug}`}
                className="group glass glass-gloss relative block overflow-hidden rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-float sm:p-7"
              >
                <span
                  aria-hidden
                  className={
                    line.code === 'A'
                      ? 'bubble -top-10 -right-8 size-36 opacity-70'
                      : 'bubble -top-12 -right-6 size-40 opacity-70 [background:radial-gradient(circle_at_32%_28%,rgb(255_255_255/0.95)_0_7%,transparent_30%),radial-gradient(circle_at_50%_50%,rgb(216_204_255/0.2)_0_55%,rgb(216_204_255/0.55)_100%)]'
                  }
                />
                <div className="relative">
                  <LineBadge line={line} />
                  <h3 className="mt-4 text-2xl font-bold">{line.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{line.description}</p>
                  <p className="mt-4 text-xs leading-relaxed text-ink-3 italic">“{line.manuscriptTitle}”</p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {factors.map((f) => (
                      <span key={f} className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-ink-2 ring-1 ring-line">
                        {FACTOR_LABELS[f]}
                      </span>
                    ))}
                  </div>
                  <dl className="mt-5 grid gap-3 border-t border-white/90 pt-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="eyebrow">Data</dt>
                      <dd className="mt-1 text-ink-2">{dsNames.join(' · ')}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Protocol</dt>
                      <dd className="mt-1 text-ink-2">{protocols[0]?.name}</dd>
                    </div>
                  </dl>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600">
                    Explore {exps.length} results
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Key findings (from the curated synthesis in the database) */}
      <section className="mt-16" aria-labelledby="findings">
        <SectionHeader
          id="findings"
          icon={<BookOpenCheck />}
          title="Key findings"
          description="Curated by the researchers from both manuscripts. Each comes with its limits; numbers are exploratory and come from noise-free simulation."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/compare?mode=synthesis">
                All evidence <ArrowRight />
              </Link>
            </Button>
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          {data.questions.slice(0, 4).map((q) => (
            <Link
              key={q.id}
              to={`/compare?mode=synthesis#${q.slug}`}
              className="group panel flex flex-col rounded-3xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[1.05rem] leading-snug font-bold">{q.question}</h3>
                <AgreementBadge agreement={q.agreement} />
              </div>
              <ul className="mt-4 space-y-3">
                {q.findings.map((f) => {
                  const line = f.researchLineId != null ? data.lines.get(f.researchLineId) : undefined;
                  return (
                    <li key={f.id} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                      {line ? <LineBadge line={line} compact /> : null}
                      <span>{firstSentence(f.observation)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-auto pt-4 text-xs text-ink-3">
                <span className="font-semibold text-ink-2">Limit: </span>
                {firstSentence(q.findings[0]?.limitations || q.openQuestions)}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Research navigation */}
      <section className="mt-16" aria-label="Research navigation">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { to: '/explore', icon: <Compass />, title: 'Explore experiments', body: 'Filter results by line, dataset, factor and model; read the metric heatmap.' },
            { to: '/compare', icon: <BarChart3 />, title: 'Compare models', body: 'Quantitative comparisons, only within protocol-compatible sets.' },
            { to: '/compare?mode=synthesis', icon: <BookOpenCheck />, title: 'Review evidence', body: 'Where the two lines agree, differ, and what remains open.' },
          ].map((n) => (
            <Link key={n.title} to={n.to} className="group glass flex items-start gap-4 rounded-3xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-float">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#e3f6fb] to-[#eae4ff] text-primary-600 ring-1 ring-white [&_svg]:size-5">
                {n.icon}
              </span>
              <span>
                <span className="flex items-center gap-1.5 font-bold">
                  {n.title}
                  <ArrowRight className="size-4 text-primary-600 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="mt-1 block text-sm text-ink-2">{n.body}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
