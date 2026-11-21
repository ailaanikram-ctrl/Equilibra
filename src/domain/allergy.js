// Allergies are HARD constraints: they are applied before ranking, never after.
const KEYS = ['k', 'p', 'c', 'f', 'fi'];
// Rough typical ranges so each nutrient contributes comparably to similarity.
const SCALE = { k: 600, p: 30, c: 80, f: 25, fi: 8 };

export const matchedAllergens = (food, allergies) => food.al.filter((a) => allergies.includes(a));
export const isSafe = (food, allergies) => matchedAllergens(food, allergies).length === 0;

/** Euclidean distance over scaled nutrition vectors; smaller = more similar. */
export function nutritionDistance(a, b) {
  let s = 0;
  for (const k of KEYS) {
    const d = (a[k] - b[k]) / SCALE[k];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Allergen-free foods with the most similar nutrition to `food`. */
export function substitutesFor(food, allergies, pool, { limit = 2, exclude = [] } = {}) {
  return pool
    .filter((f) => f.id !== food.id && isSafe(f, allergies) && !exclude.includes(f.id))
    .map((f) => ({ food: f, distance: nutritionDistance(food, f) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
