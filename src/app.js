import { FOODS, ALLERGENS, PORTIONS } from './data/foods.js';
import { calcTargets, scaleFood, dayTotals, remaining } from './domain/nutrition.js';
import { suggest } from './domain/recommend.js';
import { isSafe, matchedAllergens, substitutesFor } from './domain/allergy.js';
import { loadState, saveState, defaultState } from './storage.js';
import { esc, dayKey } from './util.js';
import { icon } from './icons.js';

/* ---------- state ---------- */
let S = loadState();
let T = calcTargets(S.profile);
let tab = 'today', scan = null, query = '', pending = null, toastTimer = null;
const $ = (s) => document.querySelector(s);
const food = (id) => FOODS.find((f) => f.id === id);
const persist = () => { saveState(S); T = calcTargets(S.profile); };
const totals = () => dayTotals(S.meals, dayKey());
const gaps = () => remaining(T, totals());
const list = (a) => a.join(', ');

const REASONS = {
  hydration_behind_plan: 'Your water so far is lower than the pace for this time of day.',
  usual_meal_window: 'This is close to a typical meal time.',
  protein_remaining: 'Protein is still below today’s target.',
  fibre_remaining: 'Fibre is still below today’s target.',
  no_gap_now: 'No meaningful gap right now, so nothing is pushed.'
};

/* ---------- presentational helpers ---------- */
const head = (title, sub = '', action = '', eyebrow = '') =>
  `<header class="page-head"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${action}</header>`;
const section = (t) => `<h2>${t}</h2>`;
const initial = () => { const ch = [...S.profile.name.trim()][0]; return ch ? esc(ch.toUpperCase()) : ''; };
const avatar = () => `<button class="avatar" onclick="goTab('profile')" aria-label="Open profile">${initial() || icon('user', 20)}</button>`;

function metric(label, v, t, unit, color) {
  const left = Math.round(t - v), pct = Math.min(100, Math.max(0, (v / t) * 100));
  return `<div class="metric"><div class="metric-top"><span class="metric-label">${label}</span><span class="metric-val"><b>${Math.round(v)}</b> / ${t} ${unit}</span></div>
<div class="bar" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${t}" aria-valuenow="${Math.min(Math.round(v), t)}"><i style="width:${pct}%;background:${color}"></i></div>
<div class="metric-sub">${left > 0 ? `${left} ${unit} remaining` : 'Target reached'}</div></div>`;
}
const macros = (f) => `${S.hideKcal ? '' : f.k + ' kcal · '}Protein ${f.p} g · Fibre ${f.fi} g · Carbs ${f.c} g · Fat ${f.f} g`;
const row = (f, btn, extra = '') => `<div class="item"><div><div class="item-name">${esc(f.n)}</div><div class="meta">${macros(f)}</div>${extra}</div>${btn}</div>`;
const logBtn = (id, label = 'Log') => `<button class="btn-primary" onclick="portion('${id}')" aria-label="${label} ${esc(food(id).n)}">${label}</button>`;
const subNote = (s) => s.substituteFor
  ? `<div class="callout">Swapped in for <b>${esc(s.substituteFor.food.n)}</b> (contains ${list(s.substituteFor.allergens)}). Similar nutrition, allergen-free.</div>` : '';

function win() {
  const h = new Date().getHours();
  const W = [[7, 10, 'Breakfast', '7:30–9:00 AM'], [12, 15, 'Lunch', '12:30–1:30 PM'], [16, 18, 'Tea-time snack', '4:00–5:00 PM'], [19, 22, 'Dinner', '7:00–8:30 PM']];
  const n = W.find((w) => h < w[1]) || W[0];
  return { meal: n[2], win: n[3], soon: h >= n[0] - 1 && h < n[1] };
}
function nba() {
  const h = new Date().getHours(), w = win(), g = gaps();
  const exp = T.water * Math.min(1, Math.max(0, (h - 7) / 13));
  if (S.water < exp - 500) return { t: 'You’re behind your usual hydration. Have some water.', r: ['hydration_behind_plan'], a: 'water' };
  if (w.soon) {
    const top = g.p >= g.fi * 2.4 ? 'protein' : 'fibre';
    return { t: `${w.meal} is coming up. Aim for ${top}${g.p > 10 && g.fi > 6 ? ' and fibre' : ''}.`, r: ['usual_meal_window', g.p > 10 && 'protein_remaining', g.fi > 6 && 'fibre_remaining'].filter(Boolean), a: 'eat' };
  }
  return { t: 'You’re nicely balanced right now. No action needed.', r: ['no_gap_now'], a: null };
}
const latestCheckin = (k) => {
  const d = dayKey(), c = [...S.checkins].reverse().find((x) => x.k === k && dayKey(new Date(x.ts)) === d);
  return c ? c.v : 0;
};

/* ---------- views ---------- */
const V = {
  today() {
    const t = totals(), n = nba(), w = win(), g = gaps(), hr = new Date().getHours();
    const name = S.profile.name.trim();
    const gr = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (name ? `, ${esc(name)}` : '');
    const date = new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' });
    const hero = `<section class="hero${S.focus ? ' big' : ''}" aria-labelledby="nba-t"><div class="eyebrow">${icon(n.a === 'water' ? 'droplet' : 'sparkle', 16)}Next best action</div>
<h2 id="nba-t" class="hero-title">${S.focus && n.a === 'eat' ? `Eat ${w.meal.toLowerCase()}` : n.t}</h2>
<div class="row">${n.a === 'water' ? '<button class="btn-primary" onclick="addWater(250)">Add 250 ml water</button>' : ''}${n.a === 'eat' ? '<button class="btn-primary" onclick="goTab(\'nutrition\')">What should I eat?</button>' : ''}<button class="btn-ghost" onclick='why(${JSON.stringify(n.r)})'>Why this?</button></div></section>`;
    const header = head(gr, '', avatar(), date);
    if (S.focus) {
      return `${header}${hero}${section('Quick options')}<div class="card list">${suggest(FOODS, g, S.allergies, 3).map((s) => row(s.food, `<button class="btn-primary" onclick="portion('${s.food.id}')">Done</button>`, subNote(s))).join('') || '<div class="empty">No suggestion available with your current allergy list.</div>'}</div>`;
    }
    return `${header}${hero}${section('Today’s nutrition')}<div class="card">${metric('Protein', t.p, T.protein, 'g', 'var(--protein)')}${metric('Fibre', t.fi, T.fibre, 'g', 'var(--fibre)')}${metric('Hydration', S.water, T.water, 'ml', 'var(--water)')}
${S.hideKcal ? '' : `<hr class="divider"><div class="row sp"><span class="mu">Energy logged</span><span><b>${t.k}</b> <span class="mu">/ ${T.kcal} kcal (${T.src === 'profile' ? 'estimate' : 'demo target'})</span></span></div>`}
<p class="fine">Incomplete isn’t bad, it’s just what’s left for the day. ${T.src === 'profile' ? 'Targets are estimated from your profile (development formula, not clinical advice).' : 'Targets are default demo values. Add your profile to personalise them.'}</p></div>
${section('Next meal')}<div class="card"><div class="row sp"><div><div class="card-title">${w.meal}</div><div class="mu">${g.p > 10 || g.fi > 6 ? 'Protein and fibre still need attention today.' : 'You’re close on today’s main targets.'}</div></div><span class="badge brand">${icon('clock', 14)}&nbsp;${w.win}</span></div>
<div class="row" style="margin-top:14px"><button class="btn-primary" onclick="remind()">Remind me</button><button onclick="later()">Later</button></div></div>`;
  },

  nutrition() {
    const q = query.trim().toLowerCase(), found = FOODS.filter((f) => f.n.toLowerCase().includes(q)), sg = suggest(FOODS, gaps(), S.allergies, 4);
    const today = S.meals.filter((m) => m.day === dayKey()).sort((a, b) => a.ts - b.ts);
    const avoiding = S.allergies.length ? `<div class="badges"><span class="mu">Avoiding</span>${S.allergies.map((a) => `<span class="badge warn">${a}</span>`).join('')}</div>` : '';
    return `${head('Nutrition', 'Log what you eat and see what’s left for today.')}
${section('What should I eat?')}<div class="card">${avoiding}<div class="list">${sg.map((s) => row(s.food, logBtn(s.food.id), subNote(s))).join('') || '<div class="empty">No suggestion available with your current allergy list.</div>'}</div>
<p class="fine">Allergen tags in this prototype are demo data. Always check real ingredients.</p></div>
${section('Find a food')}<input class="search" type="text" placeholder="Search Malaysian foods" value="${esc(query)}" oninput="setQuery(this.value)" aria-label="Search foods" autocomplete="off">
<div class="card list">${found.map((f) => {
      if (isSafe(f, S.allergies)) return row(f, logBtn(f.id));
      const alts = substitutesFor(f, S.allergies, FOODS, { limit: 2 }).map((a) => esc(a.food.n)).join(' · ');
      return row(f, '<button disabled>Blocked</button>', `<div class="callout warn">Contains ${list(matchedAllergens(f, S.allergies))}.${alts ? ` Similar: ${alts}` : ''}</div>`);
    }).join('') || '<div class="empty">No match. Try another name. Equilibra won’t invent a record.</div>'}</div>
${section('Today’s meals')}<div class="card list">${today.map((m) => `<div class="item"><div><div class="item-name">${esc(m.n)}</div><div class="meta">${new Date(m.ts).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })} · ${{ S: 'Small', M: 'Medium', L: 'Large' }[m.sz]} · Protein ${m.p} g · Fibre ${m.fi} g${m.src === 'dev-demo' ? ' · demo value' : ''}${m.conf ? ` · scan ${Math.round(m.conf * 100)}%` : ''}</div></div><button class="btn-ghost" onclick="deleteMeal(${m.ts})" aria-label="Remove ${esc(m.n)}">Remove</button></div>`).join('') || '<div class="empty">No meals logged yet. Scan a meal or search above to begin.</div>'}</div>`;
  },

  scan() {
    if (!scan) {
      const picker = (cls, label, cap) => `<label class="btn ${cls}">${label}<input class="sr-only" type="file" accept="image/*" ${cap ? 'capture="environment"' : ''} onchange="doScan(this.files[0])"></label>`;
      return `${head('Scan a meal', 'Take a photo and confirm what it is.')}
<div class="notice"><span>Development mock: this recognizer is not a trained model. It proposes placeholder candidates so the review and logging flow can be tested. Always confirm.</span></div>
<div class="dz"><div class="dz-ic">${icon('scan', 28)}</div><div class="card-title">Add a meal photo</div><div class="mu">Photos stay on your device in this prototype.</div>
<div class="row">${picker('btn-primary', 'Take photo', true)}${picker('', 'Choose photo', false)}</div></div>
<button class="btn-block" onclick="goTab('nutrition')">Search for a food instead</button>`;
    }
    if (scan.busy) return `${head('Analysing')}<div class="card row" role="status"><div class="spinner" aria-hidden="true"></div><span>Analysing photo (mock provider)…</span></div>`;
    return `${head('Review', 'Pick the closest match, or search if none fit.')}<img class="photo" src="${scan.img}" alt="Your meal photo">
${section('Best guesses')}${scan.c.map((c, i) => {
      const f = food(c.id), ok = isSafe(f, S.allergies), pct = Math.round(c.p * 100);
      return `<div class="card"><div class="row sp"><div class="card-title">${esc(f.n)}</div><span class="badge${i ? '' : ' brand'}">${i ? 'Alternative' : 'Best match'}</span></div>
<div class="conf" role="img" aria-label="Confidence ${pct} percent"><i style="width:${pct}%"></i></div>
<div class="mu">${c.p > 0.6 ? 'Fairly likely' : 'Possible'} · ${pct}% confidence (mock)</div>
${ok ? '' : `<div class="callout warn">Contains ${list(matchedAllergens(f, S.allergies))}, which is on your allergy list.</div>`}
<div style="margin-top:12px"><button class="btn-primary btn-block" onclick="portion('${c.id}',${c.p},${i ? 1 : 0})">This is right</button></div></div>`;
    }).join('')}
<div class="card"><div class="card-title">None of these</div><p class="mu">I couldn’t confidently identify this meal. Search for the dish instead.</p><button onclick="goTab('nutrition')">Search the dish</button></div>
<button class="btn-ghost btn-block" onclick="retake()">Retake photo</button>`;
  },

  health() {
    const kinds = ['Energy', 'Focus', 'Mood'];
    return `${head('Health', 'Context that supports your nutrition. Everything here is optional.')}
${section('Hydration')}<div class="card">${metric('Water', S.water, T.water, 'ml', 'var(--water)')}<div class="row" style="margin-top:14px"><button onclick="addWater(250)">+250 ml</button><button onclick="addWater(500)">+500 ml</button><button class="btn-ghost" onclick="resetWater()">Reset</button></div></div>
${section('Quick check-in')}<div class="card">${kinds.map((k) => `<div class="scale-row"><div class="row sp"><b>${k}</b><span class="mu">1 low · 5 high</span></div><div class="scale" role="group" aria-label="${k}">${[1, 2, 3, 4, 5].map((n) => `<button aria-pressed="${latestCheckin(k) === n}" aria-label="${k} ${n} of 5" onclick="checkin('${k}',${n})">${n}</button>`).join('')}</div></div>`).join('')}
<p class="fine">Skip any you like. ${S.checkins.length} check-in${S.checkins.length === 1 ? '' : 's'} stored on this device.</p></div>
${section('Body')}<div class="card row sp"><div><div class="card-title">${S.profile.w ? `${esc(S.profile.w)} kg` : 'Not set'}</div><div class="mu">${S.profile.w ? `Hydration target ${T.water} ml` : 'Add your weight to personalise hydration.'}</div></div><button onclick="goTab('profile')">Open profile</button></div>
${section('Reset')}<div class="card row sp"><div><div class="card-title">One-minute breathing</div><div class="mu">A slow guided pause.</div></div><button onclick="breathe()">Start</button></div>`;
  },

  profile() {
    const p = S.profile, sel = (v, l) => `<option value="${v}"${p.sex === v ? ' selected' : ''}>${l}</option>`;
    const tg = T.minor ? '<p class="mu">Under 18: Equilibra shows general default values and doesn’t calculate personal targets. A doctor or dietitian can advise on what’s right for you.</p>'
      : T.src === 'profile' ? `${metricLine('Protein', `${T.protein} g`)}${metricLine('Fibre', `${T.fibre} g`)}${metricLine('Water', `${T.water} ml`)}${S.hideKcal ? '' : metricLine('Energy', `${T.kcal} kcal`)}<p class="fine">Development estimate: energy = Mifflin-St Jeor × 1.4 (minimum 1,200); protein 0.8 g/kg; fibre 14 g per 1,000 kcal; water 33 ml/kg. Not clinical advice.</p>`
      : '<p class="mu">Add age, height and weight to replace the default demo targets.</p>';
    return `${head('Profile', 'Optional. Stored only on this device.', `<div class="avatar lg" aria-hidden="true">${initial() || icon('user', 28)}</div>`)}
<div class="card"><label class="field"><span>Name</span><input id="pn" type="text" maxlength="40" value="${esc(p.name)}" autocomplete="given-name"></label>
<div class="grid3"><label class="field"><span>Age</span><input id="pa" type="number" inputmode="numeric" value="${esc(p.age)}"></label>
<label class="field"><span>Height</span><input id="ph" type="number" inputmode="decimal" value="${esc(p.h)}" placeholder="cm"></label>
<label class="field"><span>Weight</span><input id="pw" type="number" inputmode="decimal" value="${esc(p.w)}" placeholder="kg"></label></div>
<label class="field"><span>Sex used in target formula</span><select id="ps">${sel('', 'Prefer not to say')}${sel('f', 'Female')}${sel('m', 'Male')}</select><small>Only used to estimate energy needs. You can leave it blank.</small></label>
<div id="pe" class="err" role="alert"></div><button class="btn-primary btn-block" onclick="saveProfile()">Save profile</button></div>
${section('Your daily targets')}<div class="card">${tg}</div>
${section('Weight log (optional)')}<div class="card"><div class="row" style="flex-wrap:nowrap"><input id="lw" type="number" inputmode="decimal" placeholder="Weight in kg" aria-label="Weight in kg"><button onclick="logWeight()">Log</button></div><div id="we" class="err" role="alert" style="margin-top:8px"></div>
${S.wlog.slice(-5).reverse().map((x) => `<div class="row sp mu" style="padding:4px 0"><span>${new Date(x.ts).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>${x.w} kg</span></div>`).join('') || '<div class="empty">No entries yet.</div>'}
<p class="fine">Shown as plain numbers. No good or bad states.</p></div>
<button class="btn-ghost btn-block" onclick="goTab('today')">Back to Today</button>`;
  },

  coach() {
    return `${head('Coach', 'Answers come from your logged data and the rules engine.')}
<div class="notice"><span>Rule-based preview: no language model is connected, and the Coach never invents nutrient numbers.</span></div>
<div class="row"><button class="pill" onclick="ask('fibre')">Why is my fibre low?</button><button class="pill" onclick="ask('next')">When should I eat next?</button><button class="pill" onclick="ask('easy')">I don’t feel like cooking</button></div>
<div class="bubble" id="ans" aria-live="polite">Ask a question above.</div>
${section('Settings')}<div class="card"><label class="setting"><span>Hide calories</span><input class="switch" type="checkbox" role="switch" ${S.hideKcal ? 'checked' : ''} onchange="setFlag('hideKcal',this.checked)"></label>
<label class="setting"><span>Focus-Friendly Mode<br><span class="mu">Fewer cards, one clear action.</span></span><input class="switch" type="checkbox" role="switch" ${S.focus ? 'checked' : ''} onchange="setFlag('focus',this.checked)"></label></div>
${section('Allergies')}<div class="card"><p class="mu">Foods containing these are never suggested. If the best match is blocked, a similar allergen-free food is offered instead.</p><div class="chips" role="group" aria-label="Allergies">${ALLERGENS.map((a) => `<label class="chip"><input type="checkbox" ${S.allergies.includes(a) ? 'checked' : ''} onchange="toggleAllergy('${a}',this.checked)"><span>${a}</span></label>`).join('')}</div></div>
${section('Your data')}<div class="card"><p class="mu">Everything stays in this browser. Photos are not uploaded or stored.</p><div class="row"><button onclick="exportData()">Export my data</button><button class="btn-danger" onclick="deleteAll()">Delete all data</button></div></div>`;
  }
};
function metricLine(label, value) { return `<div class="row sp" style="padding:4px 0"><span class="mu">${label}</span><b>${value}</b></div>`; }

/* ---------- rendering ---------- */
function draw(keepInput) {
  const m = $('#m'), y = m.scrollTop, focused = keepInput && document.activeElement && document.activeElement.type === 'text';
  m.innerHTML = V[tab]();
  document.querySelectorAll('#nav button').forEach((b) => (b.dataset.t === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  if (keepInput) {
    m.scrollTop = y;
    if (focused) { const i = m.querySelector('input[type=text]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
function sheet(html) { $('#dlg').innerHTML = html; if (!$('#dlg').open) $('#dlg').showModal(); }
function confirmSheet(title, body, okLabel, fn, danger = false) {
  pending = fn;
  sheet(`<h2 class="sheet-title">${title}</h2><p class="mu">${body}</p><div class="row end"><button onclick="closeSheet()">Cancel</button><button class="${danger ? 'btn-danger' : 'btn-primary'}" onclick="sheetOk()">${okLabel}</button></div>`);
}
function openPortion(id, conf, corrected) {
  const f = food(id);
  sheet(`<h2 class="sheet-title">${esc(f.n)}</h2><p class="mu">Choose a portion. This is an estimate, not a measurement.</p>
<div class="seg">${Object.entries(PORTIONS).map(([s, m]) => `<button onclick="logIt('${id}','${s}',${conf},${corrected})">${{ S: 'Small', M: 'Medium', L: 'Large' }[s]}<small>×${m}</small></button>`).join('')}</div>
<p class="fine">Demo values, not verified nutrition data. Sodium and micronutrients are unknown, not zero.</p><div class="row end"><button onclick="closeSheet()">Cancel</button></div>`);
}

/* ---------- actions (called from inline handlers) ---------- */
const actions = {
  goTab(t) { const changed = t !== tab; tab = t; if (t !== 'scan') scan = null; draw(); if (changed) $('#m').scrollTop = 0; },
  setQuery(v) { query = v; draw(true); },
  why(codes) {
    sheet(`<h2 class="sheet-title">Why am I seeing this?</h2>${codes.map((c) => `<p>${REASONS[c] || c}</p>`).join('')}${S.allergies.length ? '<p class="mu">Foods matching your allergy list are removed before any ranking.</p>' : ''}<div class="row end"><button class="btn-primary" onclick="closeSheet()">Got it</button></div>`);
  },
  closeSheet() { clearInterval(window.__bi); pending = null; $('#dlg').close(); },
  sheetOk() { const f = pending; pending = null; $('#dlg').close(); if (f) f(); },
  portion(id, conf = null, corrected = 0) {
    const f = food(id), hits = matchedAllergens(f, S.allergies);
    if (hits.length) confirmSheet('Contains an allergen', `${esc(f.n)} contains ${list(hits)}, which is on your allergy list. Log it anyway?`, 'Log anyway', () => openPortion(id, conf, corrected), true);
    else openPortion(id, conf, corrected);
  },
  logIt(id, sz, conf, corrected) {
    const f = food(id);
    S.meals.push({ id, n: f.n, sz, day: dayKey(), ts: Date.now(), conf, corrected: !!corrected, src: 'dev-demo', ...scaleFood(f, sz) });
    persist(); scan = null; $('#dlg').close(); tab = 'today'; draw(); $('#m').scrollTop = 0; toast('Meal logged. Today’s totals updated.');
  },
  deleteMeal(ts) { S.meals = S.meals.filter((m) => m.ts !== ts); persist(); draw(true); toast('Meal removed.'); },
  addWater(v) { S.water += v; persist(); draw(true); },
  resetWater() { S.water = 0; persist(); draw(true); },
  remind() { toast('Noted. Push reminders aren’t connected in this prototype.'); },
  later() { S.snooze++; persist(); toast('Okay, I’ll ease off on reminders.'); },
  checkin(k, v) {
    const d = dayKey();
    S.checkins = S.checkins.filter((x) => !(x.k === k && dayKey(new Date(x.ts)) === d)); // one answer per kind per day
    S.checkins.push({ k, v, ts: Date.now() }); persist(); draw(true);
  },
  setFlag(k, v) { S[k] = v; persist(); },
  toggleAllergy(a, on) { S.allergies = on ? [...new Set([...S.allergies, a])] : S.allergies.filter((x) => x !== a); persist(); toast(on ? `Avoiding ${a} in suggestions.` : `${a[0].toUpperCase() + a.slice(1)} removed from your allergy list.`); },
  saveProfile() {
    const g = (i) => document.getElementById(i).value.trim(), a = g('pa'), h = g('ph'), w = g('pw'), e = [];
    if (a && !(+a >= 5 && +a <= 120)) e.push('Age must be 5–120.');
    if (h && !(+h >= 100 && +h <= 230)) e.push('Height must be 100–230 cm.');
    if (w && !(+w >= 25 && +w <= 250)) e.push('Weight must be 25–250 kg.');
    if (e.length) { document.getElementById('pe').textContent = e.join(' '); return; }
    S.profile = { name: g('pn').slice(0, 40), age: a, h, w, sex: document.getElementById('ps').value };
    if (w && !S.wlog.length) S.wlog.push({ w: +w, ts: Date.now() });
    persist(); draw(true); toast('Profile saved. Targets updated everywhere.');
  },
  logWeight() {
    const v = +document.getElementById('lw').value;
    if (!(v >= 25 && v <= 250)) { document.getElementById('we').textContent = 'Enter a weight between 25 and 250 kg.'; return; }
    S.wlog.push({ w: v, ts: Date.now() }); S.profile.w = String(v); persist(); draw(true); toast('Weight logged.');
  },
  ask(k) {
    const g = gaps(), w = win(), nm = S.profile.name.trim() ? S.profile.name.trim() + ', ' : '';
    const quick = FOODS.filter((f) => isSafe(f, S.allergies) && f.ef !== 'mid').slice(0, 3).map((f) => f.n).join('; ');
    const msg = k === 'fibre'
      ? (g.fi > 0 ? `Fibre is at ${Math.round(totals().fi)} g against a target of ${T.fibre} g, so about ${Math.round(g.fi)} g remains. Fruit, ulam, dhal and vegetable-forward plates help.` : 'Fibre has reached today’s target.')
      : k === 'next' ? `Next up is ${w.meal.toLowerCase()}, with a suggested window of ${w.win}. It’s a flexible window, not a deadline.`
      : `You don’t need a perfect meal. Easy options: ${quick}.`;
    $('#ans').textContent = nm ? nm + msg[0].toLowerCase() + msg.slice(1) : msg;
  },
  exportData() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = 'equilibra-export.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  deleteAll() {
    confirmSheet('Delete all data?', 'This removes your profile, meals, check-ins and settings from this device. It can’t be undone.', 'Delete everything', () => { S = defaultState(); persist(); draw(); toast('All data deleted.'); }, true);
  },
  breathe() {
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    sheet('<h2 class="sheet-title">Breathe</h2><p class="mu">Follow the words. Stop whenever you like.</p><div class="orb" id="o"></div><p id="bt" role="status" style="text-align:center;font-size:18px;font-weight:600"></p><div class="row end"><button onclick="closeSheet()">Stop</button></div>');
    let i = 0;
    const step = () => {
      const bt = $('#bt'), o = $('#o');
      if (!bt || !o) { clearInterval(window.__bi); return; }
      const inn = i % 2 === 0;
      bt.textContent = inn ? 'Breathe in…' : 'Breathe out…';
      if (!rm) Object.assign(o.style, { transition: 'transform 4s ease', transform: `scale(${inn ? 1.35 : 1})` });
      if (++i > 15) actions.closeSheet();
    };
    clearInterval(window.__bi); step(); window.__bi = setInterval(step, 4000);
  },
  retake() { scan = null; draw(); },
  doScan(file) {
    if (!file) return;
    scan = { busy: true }; draw();
    const r = new FileReader();
    r.onerror = () => { scan = null; draw(); toast('Couldn’t read that photo. Try another, or search for the food.'); };
    r.onload = () => {
      const seed = file.size % FOODS.length, ids = [0, 3, 7].map((o) => FOODS[(seed + o) % FOODS.length].id);
      setTimeout(() => { if (tab !== 'scan') return; scan = { img: r.result, c: [{ id: ids[0], p: 0.62 }, { id: ids[1], p: 0.21 }, { id: ids[2], p: 0.09 }] }; draw(); }, 1200);
    };
    r.readAsDataURL(file);
  }
};

/* ---------- boot ---------- */
Object.assign(window, actions);
const NAV = [['today', 'Today', 'home'], ['nutrition', 'Nutrition', 'utensils'], ['scan', 'Scan', 'scan'], ['health', 'Health', 'activity'], ['coach', 'Coach', 'message']];
$('#nav').innerHTML = NAV.map(([t, l, i]) => (t === 'scan'
  ? `<button class="nav-scan" data-t="scan" aria-label="Scan a meal">${icon(i, 26)}</button>`
  : `<button data-t="${t}">${icon(i)}<span>${l}</span></button>`)).join('');
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) actions.goTab(b.dataset.t); });
$('#dlg').addEventListener('close', () => { clearInterval(window.__bi); pending = null; });
draw();
