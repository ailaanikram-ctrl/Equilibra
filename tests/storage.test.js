import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, defaultState } from '../src/storage.js';
import { esc, dayKey } from '../src/util.js';

test('sanitize fills missing profile fields and fixes bad shapes', () => {
  const s = sanitize({ profile: { name: 'Aisha' }, meals: 'oops', water: 'abc', allergies: null });
  assert.equal(s.profile.name, 'Aisha');
  assert.equal(s.profile.age, '');
  assert.deepEqual(s.meals, []);
  assert.deepEqual(s.allergies, []);
  assert.equal(s.water, 0);
});
test('sanitize(null) equals defaults', () => assert.deepEqual(sanitize(null), defaultState()));
test('esc neutralises HTML', () => assert.equal(esc('<img onerror="x">&\''), '&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;'));
test('dayKey uses local calendar date', () => assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05'));
