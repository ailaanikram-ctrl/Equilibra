import test from 'node:test';
import assert from 'node:assert/strict';
import { FOODS } from '../src/data/foods.js';
import { isSafe, substitutesFor, nutritionDistance } from '../src/domain/allergy.js';
import { suggest } from '../src/domain/recommend.js';

const tempeh = FOODS.find((f) => f.id === 'tm');

test('soy allergy marks soy foods unsafe', () => {
  assert.equal(isSafe(tempeh, ['soy']), false);
  assert.equal(isSafe(tempeh, ['egg']), true);
});

test('substitutes contain no allergen and are nutritionally close', () => {
  const subs = substitutesFor(tempeh, ['soy'], FOODS, { limit: 3 });
  assert.equal(subs.length, 3);
  for (const s of subs) assert.ok(isSafe(s.food, ['soy']));
  const farthest = Math.max(...FOODS.filter((f) => isSafe(f, ['soy'])).map((f) => nutritionDistance(tempeh, f)));
  assert.ok(subs[0].distance < farthest);
  assert.ok(subs[0].distance <= subs[2].distance);
});

test('suggestions never contain the user allergen (every allergen, every gap profile)', () => {
  const gapProfiles = [{ p: 60, fi: 25 }, { p: 0, fi: 25 }, { p: 60, fi: 0 }, { p: 0, fi: 0 }];
  for (const allergen of ['soy', 'egg', 'peanut', 'seafood', 'dairy']) {
    for (const gaps of gapProfiles) {
      for (const s of suggest(FOODS, gaps, [allergen], 6)) assert.ok(!s.food.al.includes(allergen), `${s.food.n} has ${allergen}`);
    }
  }
});

test('blocked top pick is replaced and the swap is explained', () => {
  const out = suggest(FOODS, { p: 60, fi: 25 }, ['soy'], 4);
  const swap = out.find((s) => s.substituteFor);
  assert.ok(swap, 'expected a substitution since tempeh stir-fry ranks highly');
  assert.equal(swap.substituteFor.food.id, 'tm');
  assert.deepEqual(swap.substituteFor.allergens, ['soy']);
  assert.ok(swap.reasons.includes('allergy_substitute'));
});

test('no duplicates and respects limit', () => {
  const out = suggest(FOODS, { p: 60, fi: 25 }, ['soy', 'egg'], 4);
  assert.equal(new Set(out.map((s) => s.food.id)).size, out.length);
  assert.ok(out.length <= 4);
});

test('multiple allergies combine', () => {
  for (const s of suggest(FOODS, { p: 40, fi: 15 }, ['soy', 'peanut', 'seafood'], 5)) {
    assert.ok(!s.food.al.some((a) => ['soy', 'peanut', 'seafood'].includes(a)));
  }
});
