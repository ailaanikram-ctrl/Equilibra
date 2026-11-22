const KEY = 'equilibra.v1';
export const defaultState = () => ({
  meals: [], water: 0, checkins: [], hideKcal: false, focus: false, allergies: [], snooze: 0,
  profile: { name: '', age: '', h: '', w: '', sex: '' }, wlog: []
});

/** Merge saved data over defaults and coerce shapes so a corrupt or older save cannot crash the UI. */
export function sanitize(raw) {
  const d = defaultState();
  const s = raw && typeof raw === 'object' ? raw : {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  const profile = { ...d.profile, ...(s.profile && typeof s.profile === 'object' ? s.profile : {}) };
  for (const k of Object.keys(d.profile)) profile[k] = typeof profile[k] === 'string' ? profile[k] : String(profile[k] ?? '');
  return {
    ...d, ...s, profile,
    meals: arr(s.meals), checkins: arr(s.checkins), wlog: arr(s.wlog), allergies: arr(s.allergies),
    water: Number.isFinite(+s.water) ? +s.water : 0,
    snooze: Number.isFinite(+s.snooze) ? +s.snooze : 0,
    hideKcal: !!s.hideKcal, focus: !!s.focus
  };
}
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch { return defaultState(); }
}
export function saveState(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: keep running in memory */ }
}
