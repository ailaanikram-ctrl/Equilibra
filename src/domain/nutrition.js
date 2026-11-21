import { DEFAULT_TARGETS, PORTIONS } from '../data/foods.js';

/** Development estimate, NOT clinical advice. Under-18s get defaults only. */
export function calcTargets(profile = {}) {
  const t = { ...DEFAULT_TARGETS, src: 'default', minor: false };
  const a = +profile.age, h = +profile.h, w = +profile.w;
  if (a > 0 && a < 18) return { ...t, minor: true };
  if (a >= 18 && h >= 100 && h <= 230 && w >= 25 && w <= 250) {
    const sx = profile.sex === 'm' ? 5 : profile.sex === 'f' ? -161 : -78;
    const bmr = 10 * w + 6.25 * h - 5 * a + sx;
    t.kcal = Math.max(1200, Math.round((bmr * 1.4) / 50) * 50);
    t.protein = Math.round(w * 0.8);
    t.fibre = Math.round((t.kcal / 1000) * 14);
    t.water = Math.round((w * 33) / 50) * 50;
    t.src = 'profile';
  }
  return t;
}

export const scaleFood = (food, size) => {
  const m = PORTIONS[size];
  const o = {};
  for (const k of ['k', 'p', 'c', 'f', 'fi']) o[k] = Math.round(food[k] * m);
  return o;
};

export function dayTotals(meals, day) {
  const t = { k: 0, p: 0, c: 0, f: 0, fi: 0 };
  for (const m of meals) if (m.day === day) for (const k in t) t[k] += m[k];
  return t;
}

export const remaining = (targets, totals) => ({ p: targets.protein - totals.p, fi: targets.fibre - totals.fi });
