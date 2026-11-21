import test from 'node:test';
import assert from 'node:assert/strict';
import { calcTargets, scaleFood, dayTotals, remaining } from '../src/domain/nutrition.js';
import { FOODS } from '../src/data/foods.js';

test('defaults when profile is empty', () => {
  const t = calcTargets({});
  assert.equal(t.src, 'default');
  assert.equal(t.protein, 60);
});
test('adult profile personalises targets', () => {
  const t = calcTargets({ age: '30', h: '170', w: '70', sex: '' });
  assert.equal(t.src, 'profile');
  assert.equal(t.protein, 56);
  assert.equal(t.water, 2300);
  assert.ok(t.kcal >= 1200);
});
test('under 18 keeps defaults and flags minor', () => {
  const t = calcTargets({ age: '15', h: '165', w: '55' });
  assert.equal(t.src, 'default');
  assert.equal(t.minor, true);
});
test('invalid values are ignored', () => {
  assert.equal(calcTargets({ age: '30', h: '10', w: '70' }).src, 'default');
});
test('portion scaling and daily totals', () => {
  const nl = FOODS[0];
  assert.equal(scaleFood(nl, 'M').p, 17);
  assert.equal(scaleFood(nl, 'L').p, Math.round(17 * 1.3));
  const tot = dayTotals([{ day: 'd', k: 1, p: 10, c: 2, f: 3, fi: 4 }, { day: 'x', k: 9, p: 9, c: 9, f: 9, fi: 9 }], 'd');
  assert.equal(tot.p, 10);
  assert.deepEqual(remaining({ protein: 60, fibre: 25 }, tot), { p: 50, fi: 21 });
});
