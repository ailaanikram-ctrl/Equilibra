const KEY = 'equilibra.v1';
export const defaultState = () => ({
  meals: [], water: 0, checkins: [], hideKcal: false, focus: false, allergies: [], snooze: 0,
  profile: { name: '', age: '', h: '', w: '', sex: '' }, wlog: []
});
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch { return defaultState(); }
}
export function saveState(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: keep running in memory */ }
}
