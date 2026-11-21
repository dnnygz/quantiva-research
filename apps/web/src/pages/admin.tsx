import { useState, type FormEvent } from 'react';
import { FlaskConical, Images, KeyRound, LogOut, BookOpenCheck } from 'lucide-react';
import { type AdminUser } from '@qa/shared';
import { GlassCard } from '@/components/aero/glass-card';
import { BubbleField } from '@/components/aero/bubbles';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState, PageSkeleton } from '@/components/feedback/states';
import { ExperimentsAdmin } from '@/components/admin/experiments-admin';
import { FindingsAdmin } from '@/components/admin/findings-admin';
import { FiguresAdmin } from '@/components/admin/figures-admin';
import { useAsync } from '@/hooks/use-async';
import { useResearchState } from '@/hooks/research-data';
import { api, ApiError } from '@/lib/api';

export default function AdminPage() {
  const { state, reload } = useAsync(async (signal) => {
    try {
      return (await api.get<{ user: AdminUser }>('/auth/me', signal)).user;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  }, []);

  if (state.status === 'loading') return <PageSkeleton />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={reload} />;
  if (!state.data) return <LoginForm onDone={reload} />;
  return <AdminLayout user={state.data} onLogout={reload} />;
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/login', { email: String(form.get('email')), password: String(form.get('password')) });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-[70dvh] place-items-center py-12">
      <BubbleField preset="hero" />
      <GlassCard gloss className="relative w-full max-w-sm p-7">
        <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-white to-[#d9f1fb] text-primary-600 shadow-soft ring-1 ring-white">
          <KeyRound className="size-5" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">Researcher sign in</h1>
        <p className="mt-1 text-sm text-ink-2">Administration is restricted to the research team. Visitors have read-only access.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-[#fff1ea] px-3 py-2 text-sm text-[#9a3412]">
              {error}
            </p>
          )}
          <Button type="submit" variant="aero" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}

function AdminLayout({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const { state, reload: reloadPublic } = useResearchState();
  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    onLogout();
  }
  if (state.status === 'loading') return <PageSkeleton />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={reloadPublic} />;
  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Research records"
        description="Register experiments, metrics, figures and findings. Only published records are visible to visitors; changes appear in the public views without editing code."
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-ink-3 sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut /> Sign out
            </Button>
          </div>
        }
      />
      <Tabs defaultValue="experiments">
        <TabsList aria-label="Admin sections">
          <TabsTrigger value="experiments">
            <FlaskConical /> Experiments
          </TabsTrigger>
          <TabsTrigger value="findings">
            <BookOpenCheck /> Findings
          </TabsTrigger>
          <TabsTrigger value="figures">
            <Images /> Figures
          </TabsTrigger>
        </TabsList>
        <TabsContent value="experiments">
          <ExperimentsAdmin onChanged={reloadPublic} />
        </TabsContent>
        <TabsContent value="findings">
          <FindingsAdmin onChanged={reloadPublic} />
        </TabsContent>
        <TabsContent value="figures">
          <FiguresAdmin onChanged={reloadPublic} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
