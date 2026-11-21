/**
 * Loads the public research data once per visit (catalog + published
 * experiments with metrics + synthesis questions, a few tens of KB) and exposes
 * indexed lookups. Filtering and charting happen client-side from this data.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Catalog,
  ComparisonSet,
  Dataset,
  Experiment,
  Protocol,
  ResearchLine,
  ResearchQuestion,
} from '@qa/shared';
import { api } from '@/lib/api';

export interface ResearchData {
  catalog: Catalog;
  experiments: Experiment[];
  questions: ResearchQuestion[];
  lines: Map<number, ResearchLine>;
  lineBySlug: Map<string, ResearchLine>;
  datasets: Map<number, Dataset>;
  protocols: Map<number, Protocol>;
  sets: Map<number, ComparisonSet>;
  setBySlug: Map<string, ComparisonSet>;
  experimentsById: Map<number, Experiment>;
  experimentsBySlug: Map<string, Experiment>;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: ResearchData };

const Ctx = createContext<{ state: State; reload: () => void } | null>(null);

function index(catalog: Catalog, experiments: Experiment[], questions: ResearchQuestion[]): ResearchData {
  return {
    catalog,
    experiments,
    questions,
    lines: new Map(catalog.researchLines.map((l) => [l.id, l])),
    lineBySlug: new Map(catalog.researchLines.map((l) => [l.slug, l])),
    datasets: new Map(catalog.datasets.map((d) => [d.id, d])),
    protocols: new Map(catalog.protocols.map((p) => [p.id, p])),
    sets: new Map(catalog.comparisonSets.map((s) => [s.id, s])),
    setBySlug: new Map(catalog.comparisonSets.map((s) => [s.slug, s])),
    experimentsById: new Map(experiments.map((e) => [e.id, e])),
    experimentsBySlug: new Map(experiments.map((e) => [e.slug, e])),
  };
}

export function ResearchDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      api.get<Catalog>('/catalog', ctrl.signal),
      api.get<Experiment[]>('/experiments', ctrl.signal),
      api.get<ResearchQuestion[]>('/questions', ctrl.signal),
    ])
      .then(([catalog, experiments, questions]) =>
        setState({ status: 'ready', data: index(catalog, experiments, questions) }),
      )
      .catch((error: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      });
    return () => ctrl.abort();
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const value = useMemo(() => ({ state, reload }), [state, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useResearchState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useResearchState must be used inside ResearchDataProvider');
  return ctx;
}

/** Use inside <RequireData>, where data is guaranteed to be loaded. */
export function useResearch(): ResearchData {
  const { state } = useResearchState();
  if (state.status !== 'ready') throw new Error('Research data not loaded');
  return state.data;
}
