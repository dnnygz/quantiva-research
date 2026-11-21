import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResearchDataProvider } from '@/hooks/research-data';
import { router } from '@/router';
import '@/styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={150}>
      <ResearchDataProvider>
        <RouterProvider router={router} />
      </ResearchDataProvider>
    </TooltipProvider>
  </StrictMode>,
);
