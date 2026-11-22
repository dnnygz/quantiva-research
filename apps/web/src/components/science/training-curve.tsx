import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart as LineIcon } from 'lucide-react';
import type { TrainingPoint } from '@qa/shared';
import { EmptyState } from '@/components/feedback/states';

/**
 * Loss per epoch — rendered only from real recorded history. When no per-epoch
 * data exists the component says so; it never reconstructs a curve from final metrics.
 */
export function TrainingCurve({ points }: { points: TrainingPoint[] }) {
  if (points.length === 0) {
    return (
      <EmptyState
        compact
        icon={<LineIcon />}
        title="No per-epoch history recorded"
        description="The paper reports final metrics only. A curve appears here once researchers upload real per-epoch losses; it is never reconstructed from final values."
      />
    );
  }
  const hasVal = points.some((p) => p.valLoss !== null);
  return (
    <figure aria-label="Training and validation loss per epoch" className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#e3edf4" vertical={false} />
          <XAxis dataKey="epoch" tick={{ fill: '#56708a', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#d5e6f2' }} label={{ value: 'Epoch', position: 'insideBottom', offset: -4, fill: '#56708a', fontSize: 11 }} />
          <YAxis tick={{ fill: '#56708a', fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #fff', boxShadow: '0 12px 32px -16px rgb(23 50 77 / 0.35)', fontSize: 12 }}
            labelFormatter={(l) => `Epoch ${l}`}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Line type="monotone" dataKey="trainLoss" name="Training loss" stroke="#1f86d1" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} connectNulls />
          {hasVal && (
            <Line type="monotone" dataKey="valLoss" name="Validation loss" stroke="#e0793c" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
