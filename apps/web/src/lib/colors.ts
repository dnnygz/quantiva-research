/**
 * Data colors.
 *
 * Model identity uses a fixed categorical order in Aero hues, validated with the
 * dataviz palette checker on white (all checks pass: worst adjacent CVD ΔE 9.2,
 * normal-vision ΔE 16.7, every slot ≥ 3:1). Color follows the model, never its rank.
 *
 * Magnitude uses one-hue sequential ramps, and the hue tells you how to read it:
 *   - teal ramp    → "higher is better" (AUC, balanced accuracy, recall)
 *   - lavender ramp → "lower is better" (gap, Brier, log loss): darker = larger = worse
 *   - coral ↔ gray ↔ teal → signed differences, neutral gray at zero
 */
import { MODEL_ORDER, metricDefinition, type MetricDirection } from '@qa/shared';

export const MODEL_COLORS: Record<string, string> = {
  VQC: '#1f86d1',
  LR: '#e0793c',
  SVM: '#14a085',
  RF: '#8a6fdf',
  XGBoost: '#d8609b',
  MLP: '#6f9410',
};
const FALLBACK = '#7088a0';

export function modelColor(modelName: string) {
  return MODEL_COLORS[modelName] ?? FALLBACK;
}

export function modelRank(modelName: string) {
  const i = (MODEL_ORDER as readonly string[]).indexOf(modelName);
  return i === -1 ? MODEL_ORDER.length : i;
}

const RAMPS: Record<Exclude<MetricDirection, 'diverging'>, string[]> = {
  higher: ['#effafc', '#c9eef5', '#93d9e8', '#52bcd3', '#1f95b8', '#0b6c8c'],
  lower: ['#f6f3ff', '#e2daff', '#c6b8f7', '#a491e8', '#8169d4', '#5c43b0'],
  neutral: ['#f2f6fa', '#dbe6f0', '#bccfe0', '#93afc9', '#6c8eae', '#4b6e8f'],
};
const DIVERGING_NEG = ['#f3efec', '#f7d6c8', '#efb197', '#e2866a', '#c95f43'];
const DIVERGING_POS = ['#f3efec', '#cde9ef', '#94d2e1', '#4fb0c9', '#16879f'];

function hexToRgb(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function rgbToHex([r, g, b]: number[]) {
  return `#${[r, g, b].map((v) => Math.round(v!).toString(16).padStart(2, '0')).join('')}`;
}
function sample(ramp: string[], t: number) {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(ramp[i]!);
  const b = hexToRgb(ramp[i + 1]!);
  return rgbToHex(a.map((v, k) => v + (b[k]! - v) * f));
}

export interface ColorScale {
  direction: MetricDirection;
  domain: [number, number];
  color: (v: number) => string;
  ramp: string[];
  legend: { low: string; high: string };
}

export function scaleFor(metricName: string, values: number[]): ColorScale {
  const direction = metricDefinition(metricName).direction;
  const finite = values.filter((v) => Number.isFinite(v));
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 1;

  if (direction === 'diverging') {
    const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    return {
      direction,
      domain: [-m, m],
      color: (v) =>
        v >= 0
          ? legibleCell(sample(DIVERGING_POS, v / m), '#0b5f73')
          : legibleCell(sample(DIVERGING_NEG, -v / m), '#8f3a22'),
      ramp: [...DIVERGING_NEG].reverse().concat(DIVERGING_POS.slice(1)),
      legend: { low: 'Negative', high: 'Positive' },
    };
  }
  if (direction === 'lower') lo = Math.min(0, lo);
  if (hi - lo < 1e-9) {
    hi = lo + 1;
  }
  const ramp = RAMPS[direction];
  return {
    direction,
    domain: [lo, hi],
    color: (v) => legibleCell(sample(ramp, (v - lo) / (hi - lo)), ramp.at(-1)!),
    ramp,
    legend:
      direction === 'higher'
        ? { low: 'Lower (worse)', high: 'Higher (better)' }
        : direction === 'lower'
          ? { low: 'Smaller (better)', high: 'Larger (worse)' }
          : { low: 'Lower', high: 'Higher' },
  };
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const INK_DARK = '#17324d';
const INK_DARK_LUM = luminance(INK_DARK);
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** Luminance limits where white (≤ LOW) or navy (≥ HIGH) text reaches 4.5:1. */
const LUM_WHITE_MAX = 1.05 / 4.5 - 0.05;
const LUM_NAVY_MIN = 4.5 * (INK_DARK_LUM + 0.05) - 0.05;

function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i]! - v) * t));
}

/**
 * Mid-tone cells can fall in a luminance band where neither navy nor white
 * text reaches WCAG AA (4.5:1). Nudge such a color to the nearest edge of the
 * band (lighter toward white, darker toward the ramp's darkest step), keeping
 * the order of the scale intact.
 */
export function legibleCell(bg: string, darkest: string) {
  const l = luminance(bg);
  if (l <= LUM_WHITE_MAX || l >= LUM_NAVY_MIN) return bg;
  const towardLight = l - LUM_WHITE_MAX > LUM_NAVY_MIN - l;
  for (let t = 0.04; t <= 1; t += 0.04) {
    const c = towardLight ? mix(bg, '#ffffff', t) : mix(bg, darkest, t);
    const lc = luminance(c);
    if (towardLight ? lc >= LUM_NAVY_MIN : lc <= LUM_WHITE_MAX) return c;
  }
  return towardLight ? '#ffffff' : darkest;
}

/** Readable ink on a colored cell: whichever of navy / white contrasts more. */
export function inkOn(bg: string) {
  const l = luminance(bg);
  return contrast(l, INK_DARK_LUM) >= contrast(l, 1) ? INK_DARK : '#ffffff';
}
