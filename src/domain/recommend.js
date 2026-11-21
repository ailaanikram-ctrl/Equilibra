import { isSafe, matchedAllergens, substitutesFor } from './allergy.js';

/** Higher = fills more of the remaining protein/fibre gap. Pure and deterministic. */
export const score = (food, gaps) =>
  Math.min(food.p, Math.max(0, gaps.p)) + Math.min(food.fi, Math.max(0, gaps.fi)) * 3 - (food.ef === 'mid' ? 3 : 0);

export function reasonCodes(food, gaps) {
  const r = [];
  if (gaps.p > 10 && food.p >= 15) r.push('protein_remaining');
  if (gaps.fi > 6 && food.fi >= 5) r.push('fibre_remaining');
  return r;
}

/**
 * Rank by nutrition gap. A food containing one of the user's allergens is NEVER returned;
 * the most nutritionally similar allergen-free food is suggested in its place.
 */
export function suggest(foods, gaps, allergies, limit = 4) {
  const ranked = [...foods].sort((a, b) => score(b, gaps) - score(a, gaps));
  const out = [];
  const used = new Set();
  for (const f of ranked) {
    if (out.length >= limit) break;
    if (isSafe(f, allergies)) {
      if (used.has(f.id)) continue;
      used.add(f.id);
      out.push({ food: f, reasons: reasonCodes(f, gaps), substituteFor: null });
      continue;
    }
    const sub = substitutesFor(f, allergies, foods, { limit: 1, exclude: [...used] })[0];
    if (!sub) continue;
    used.add(sub.food.id);
    out.push({
      food: sub.food,
      reasons: [...reasonCodes(sub.food, gaps), 'allergy_substitute'],
      substituteFor: { food: f, allergens: matchedAllergens(f, allergies) }
    });
  }
  return out;
}
