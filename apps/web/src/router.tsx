import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { ErrorState, PageSkeleton } from '@/components/feedback/states';
import { useResearchState } from '@/hooks/research-data';
import OverviewPage from '@/pages/overview';
import NotFoundPage from '@/pages/not-found';

const ExplorePage = lazy(() => import('@/pages/explore'));
const ExperimentPage = lazy(() => import('@/pages/experiment'));
const ComparePage = lazy(() => import('@/pages/compare'));
const AdminPage = lazy(() => import('@/pages/admin'));

/** Renders children once the public research data has loaded. */
function RequireData({ children }: { children: ReactNode }) {
  const { state, reload } = useResearchState();
  if (state.status === 'loading') return <PageSkeleton />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={reload} />;
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <RequireData><OverviewPage /></RequireData> },
      { path: 'explore', element: <RequireData><ExplorePage /></RequireData> },
      { path: 'experiments/:slug', element: <RequireData><ExperimentPage /></RequireData> },
      { path: 'compare', element: <RequireData><ComparePage /></RequireData> },
      {
        path: 'admin/*',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <AdminPage />
          </Suspense>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
