import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Atom, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/explore', label: 'Explore' },
  { to: '/compare', label: 'Compare' },
  { to: '/admin', label: 'Admin' },
];

function Brand() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 rounded-full pr-2" aria-label="Quantum-Aware home">
      <span className="relative grid size-9 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0%,#a9deff_45%,#1a8fb8_100%)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_6px_14px_-6px_rgb(10_115_150/0.6)] ring-1 ring-white">
        <Atom className="size-4.5 drop-shadow" strokeWidth={2.2} />
      </span>
      <span className="leading-tight">
        <span className="block text-[0.95rem] font-bold tracking-tight">Quantum-Aware</span>
        <span className="block text-[0.68rem] font-medium text-ink-3">Research Explorer</span>
      </span>
    </Link>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <nav
          aria-label="Main"
          className="glass glass-gloss mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-full py-1.5 pr-2 pl-2.5"
        >
          <Brand />
          <ul className="hidden items-center gap-1 rounded-full bg-[#e9f4fb]/70 p-1 ring-1 ring-white md:flex">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200',
                      isActive ? 'bg-white text-ink shadow-soft' : 'text-ink-2 hover:text-ink',
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <span className="hidden w-[150px] justify-end text-[0.7rem] font-medium text-ink-3 lg:flex">
            Simulated · noise-free
          </span>
          <button
            className="grid size-10 place-items-center rounded-full text-ink hover:bg-white/80 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>
        {open && (
          <ul id="mobile-nav" className="glass mx-auto mt-2 grid max-w-7xl gap-1 rounded-3xl p-2 animate-rise md:hidden">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-2xl px-4 py-3 text-[0.95rem] font-semibold',
                      isActive ? 'bg-white text-ink shadow-soft' : 'text-ink-2',
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-white/80 bg-white/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-ink-3 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>
            <span className="font-semibold text-ink-2">Quantum-Aware Research Explorer</span> · Universidad Peruana de
            Ciencias Aplicadas
          </p>
          <p className="max-w-xl md:text-right">
            Results from noise-free simulation, published in two manuscripts. Exploratory research — not a clinical or
            diagnostic tool, and no claim of quantum advantage.
          </p>
        </div>
      </footer>
    </div>
  );
}
