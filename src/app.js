import { FOODS, ALLERGENS, PORTIONS } from './data/foods.js';
import { calcTargets, scaleFood, dayTotals, remaining } from './domain/nutrition.js';
import { suggest } from './domain/recommend.js';
import { isSafe, matchedAllergens, substitutesFor } from './domain/allergy.js';
import { loadState, saveState, defaultState } from './storage.js';
import { esc, dayKey } from './util.js';

let S = loadState();
let T = calcTargets(S.profile);
let tab = 'today', scan = null, query = '', note = '';
const $ = (s) => document.querySelector(s);
const food = (id) => FOODS.find((f) => f.id === id);
const persist = () => { saveState(S); T = calcTargets(S.profile); };
const totals = () => dayTotals(S.meals, dayKey());
const gaps = () => remaining(T, totals());

const REASONS = {
  hydration_behind_plan: 'Your water so far is lower than the pace for this time of day.',
  usual_meal_window: 'This is close to a typical meal time.',
  protein_remaining: 'Protein is still below today’s target.',
  fibre_remaining: 'Fibre is still below today’s target.',
  no_gap_now: 'No meaningful gap right now, so nothing is pushed.',
  allergy_substitute: 'The best-fitting food contains one of your allergens, so a similar allergen-free option is shown.'
};

const bar = (l, v, t, u, col) => `<div class="row sp"><b>${l}</b><span class="mu">${Math.round(v)} / ${t} ${u} · ${Math.max(0, Math.round(t - v))} ${u} remaining</span></div><div class="bar" role="img" aria-label="${l} ${Math.round(v)} of ${t} ${u}"><i style="width:${Math.min(100, (v / t) * 100)}%;background:${col}"></i></div>`;
const macros = (f) => `${S.hideKcal ? '' : f.k + ' kcal · '}P ${f.p}g · Fibre ${f.fi}g · C ${f.c}g · F ${f.f}g`;
const row = (f, btn, extra = '') => `<div class="item"><div><b>${esc(f.n)}</b><div class="mu">${macros(f)}</div>${extra}</div>${btn}</div>`;
const logBtn = (id) => `<button class="p" onclick="portion('${id}')">Log</button>`;

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

const V = {
  today() {
    const t = totals(), n = nba(), w = win(), g = gaps(), hr = new Date().getHours();
    const gr = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (S.profile.name ? ', ' + esc(S.profile.name) : '');
    const hero = `<div class="card hero"><div class="mu">NEXT BEST ACTION</div><h1 style="font-size:${S.focus ? 28 : 20}px;margin:6px 0 10px">${S.focus && n.a === 'eat' ? 'Eat ' + w.meal.toLowerCase() : n.t}</h1><div class="row">${n.a === 'water' ? '<button onclick="addWater(250)">+250 ml water</button>' : ''}${n.a === 'eat' ? '<button onclick="goTab(\'nutrition\')">What should I eat?</button>' : ''}<button onclick='why(${JSON.stringify(n.r)})'>Why?</button></div></div>`;
    if (S.focus) return `<h1>${gr}</h1>${hero}<h2>Quick options</h2><div class="card">${suggest(FOODS, g, S.allergies, 3).map((s) => row(s.food, `<button class="p" onclick="portion('${s.food.id}')">Done</button>`, subNote(s))).join('')}</div>`;
    return `<div class="row sp"><h1>${gr}</h1><button onclick="goTab('profile')" aria-label="Open profile">👤 Profile</button></div><div class="mu">${new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })}</div><div style="height:12px"></div>${hero}
<h2>TODAY’S NUTRITION</h2><div class="card">${bar('Protein', t.p, T.protein, 'g', 'var(--co)')}${bar('Fibre', t.fi, T.fibre, 'g', 'var(--lf)')}${bar('Hydration', S.water, T.water, 'ml', 'var(--wa)')}${S.hideKcal ? '' : `<div class="mu" style="margin-top:6px">Energy: ${t.k} kcal logged (${T.src === 'profile' ? 'estimated' : 'demo'} target ${T.kcal})</div>`}
<p class="mu">Incomplete isn’t bad — it’s just what’s left for the day. ${T.src === 'profile' ? 'Targets are estimated from your profile (dev formula, not clinical advice).' : 'Targets are default demo values — add your profile to personalise.'}</p></div>
<h2>NEXT MEAL</h2><div class="card"><b>${w.meal}</b><div class="mu">Suggested window: ${w.win}</div><div class="mu">${g.p > 10 || g.fi > 6 ? 'Protein and fibre still need attention today.' : 'You’re close on today’s main targets.'}</div><div class="row" style="margin-top:8px"><button onclick="alert('Reminder queued (demo: no push provider connected).')">Remind me</button><button onclick="later()">Later</button></div></div>`;
  },
  nutrition() {
    const q = query.toLowerCase(), list = FOODS.filter((f) => f.n.toLowerCase().includes(q)), sg = suggest(FOODS, gaps(), S.allergies, 4);
    const today = S.meals.filter((m) => m.day === dayKey());
    return `<h1>Nutrition</h1><h2>WHAT SHOULD I EAT?</h2><div class="card">${S.allergies.length ? `<div class="mu">Allergy filter active (${S.allergies.join(', ')}). Matching foods are never suggested.</div>` : ''}${sg.map((s) => row(s.food, logBtn(s.food.id), subNote(s))).join('') || '<div class="mu">No suggestion available with your current allergy list.</div>'}<p class="tag">Allergen tags in this prototype are demo data — always check real ingredients.</p></div>
<h2>SEARCH & LOG</h2><input type="text" placeholder="Search Malaysian foods" value="${esc(query)}" oninput="setQuery(this.value)" aria-label="Search foods"><div class="card" style="margin-top:8px">${list.map((f) => {
      if (isSafe(f, S.allergies)) return row(f, `<button onclick="portion('${f.id}')">Log</button>`);
      const alts = substitutesFor(f, S.allergies, FOODS, { limit: 2 }).map((a) => esc(a.food.n)).join('; ');
      return row(f, '<button disabled>Allergen</button>', `<div class="tag">Contains ${matchedAllergens(f, S.allergies).join(', ')}. Similar: ${alts}</div>`);
    }).join('') || '<div class="mu">No match. Try another name — Equilibra won’t invent a record.</div>'}</div>
<h2>TODAY’S MEALS</h2><div class="card">${today.map((m) => `<div class="item"><div><b>${esc(m.n)}</b><div class="mu">${m.sz} · P ${m.p}g · Fibre ${m.fi}g · ${m.src === 'dev-demo' ? 'demo value' : 'sourced'}${m.conf ? ' · scan ' + Math.round(m.conf * 100) + '%' : ''}</div></div><button onclick="deleteMeal(${m.ts})" aria-label="Delete ${esc(m.n)}">Delete</button></div>`).join('') || '<div class="mu">No meals logged yet. Scan or search to begin.</div>'}</div>`;
  },
  scan() {
    if (!scan) return `<h1>Scan a meal</h1><div class="card warn"><b>Dev mock recognizer</b><div class="mu">This is not a trained model. It proposes placeholder candidates so the review → correct → portion → log flow can be tested. Always confirm.</div></div><label class="card" style="display:block;text-align:center"><b>Take or choose a photo</b><input type="file" accept="image/*" capture="environment" style="display:none" onchange="doScan(this.files[0])"></label><button style="width:100%" onclick="goTab('nutrition')">Search manually instead</button>`;
    if (scan.busy) return '<h1>Analysing…</h1><div class="card" role="status">Analysing photo (mock provider). Almost done.</div>';
    return `<h1>Review</h1><img src="${scan.img}" alt="Your meal photo" style="width:100%;border-radius:var(--r);max-height:220px;object-fit:cover"><h2>BEST GUESS (mock)</h2>${scan.c.map((c, i) => {
      const f = food(c.id), ok = isSafe(f, S.allergies);
      return `<div class="card"><b>${esc(f.n)}</b><div class="mu">${i ? 'Alternative' : 'Best candidate'} · ${c.p > 0.6 ? 'fairly likely' : 'possible'} (${Math.round(c.p * 100)}%)</div>${ok ? '' : `<div class="tag">Contains ${matchedAllergens(f, S.allergies).join(', ')} — your allergy.</div>`}<button class="p" style="margin-top:8px" onclick="portion('${c.id}',${c.p},${i ? 1 : 0})">This is right — choose portion</button></div>`;
    }).join('')}<div class="card"><b>None of these</b><div class="mu">I couldn’t confidently identify this meal. Search for the dish.</div><button onclick="goTab('nutrition')">Search the dish</button></div><button onclick="retake()">Retake</button>`;
  },
  health() {
    return `<h1>Health</h1><h2>HYDRATION</h2><div class="card">${bar('Water', S.water, T.water, 'ml', 'var(--wa)')}<div class="row"><button onclick="addWater(250)">+250 ml</button><button onclick="addWater(500)">+500 ml</button><button onclick="resetWater()">Reset</button></div></div>
<h2>OPTIONAL CHECK-IN (skip any)</h2><div class="card">${['Energy', 'Focus', 'Mood'].map((k) => `<div class="row sp"><span>${k}</span><span class="row">${[1, 2, 3, 4, 5].map((n) => `<button style="min-width:44px;padding:6px" aria-label="${k} ${n} of 5" onclick="checkin('${k}',${n})">${n}</button>`).join('')}</span></div>`).join('')}<div class="mu">${S.checkins.length} check-ins stored on this device.</div></div>
<h2>BODY (OPTIONAL)</h2><div class="card">${S.profile.w ? `Weight ${esc(S.profile.w)} kg · hydration target ${T.water} ml` : 'Add your weight to personalise your hydration target.'}<div class="row" style="margin-top:8px"><button onclick="goTab('profile')">Open profile</button></div></div>
<h2>RESET</h2><div class="card"><button onclick="breathe()">1-minute breathing reset</button></div>`;
  },
  profile() {
    const p = S.profile, pm = note; note = '';
    const tg = T.minor ? '<p class="mu">Under 18: Equilibra shows general default values and doesn’t calculate personal targets. A doctor or dietitian can advise on what’s right for you.</p>'
      : T.src === 'profile' ? `<div class="mu">Protein ${T.protein} g · Fibre ${T.fibre} g · Water ${T.water} ml${S.hideKcal ? '' : ' · Energy ' + T.kcal + ' kcal'}</div><p class="mu">Dev estimate: energy = Mifflin-St Jeor × 1.4 (min 1,200); protein 0.8 g/kg; fibre 14 g per 1,000 kcal; water 33 ml/kg. Not clinical advice.</p>`
      : '<p class="mu">Add age, height and weight to replace the default demo targets.</p>';
    const sel = (v, l) => `<option value="${v}"${p.sex === v ? ' selected' : ''}>${l}</option>`;
    return `<h1>Profile</h1><p class="mu">Optional. Stored only on this device and used to estimate demo targets.</p><div class="card">
<label class="b">Name<input id="pn" type="text" value="${esc(p.name)}" autocomplete="given-name"></label>
<label class="b">Age<input id="pa" type="number" inputmode="numeric" value="${esc(p.age)}"></label>
<label class="b">Height (cm)<input id="ph" type="number" inputmode="decimal" value="${esc(p.h)}"></label>
<label class="b">Weight (kg)<input id="pw" type="number" inputmode="decimal" value="${esc(p.w)}"></label>
<label class="b">Sex used in formula (optional)<select id="ps">${sel('', 'Prefer not to say')}${sel('f', 'Female')}${sel('m', 'Male')}</select></label>
<div id="pe" role="alert" class="tag"></div><button class="p" onclick="saveProfile()">Save profile</button><div class="mu" role="status">${pm}</div></div>
<h2>YOUR TARGETS</h2><div class="card">${tg}</div>
<h2>WEIGHT LOG (OPTIONAL)</h2><div class="card"><div class="row"><input id="lw" type="number" inputmode="decimal" placeholder="kg" style="flex:1"><button onclick="logWeight()">Log weight</button></div>${S.wlog.slice(-5).reverse().map((x) => `<div class="mu">${new Date(x.ts).toLocaleDateString('en-MY')}: ${x.w} kg</div>`).join('') || '<div class="mu">No entries.</div>'}<div class="mu">Shown as plain numbers — no good or bad states.</div></div><button onclick="goTab('today')">Back to Today</button>`;
  },
  coach() {
    return `<h1>Coach</h1><div class="card warn"><b>Rule-based preview</b><div class="mu">No LLM is connected. Answers come from the deterministic engine; the Coach never makes up nutrient numbers.</div></div><div class="row"><button onclick="ask('fibre')">Why is my fibre low?</button><button onclick="ask('next')">When should I eat next?</button><button onclick="ask('easy')">I don’t feel like cooking</button></div><div class="card" id="ans" aria-live="polite">Ask a question above.</div>
<h2>PROFILE</h2><div class="card row sp"><span>${S.profile.name ? esc(S.profile.name) : 'Not set up'}</span><button onclick="goTab('profile')">Open profile</button></div>
<h2>SETTINGS & PRIVACY</h2><div class="card"><label class="f"><input type="checkbox" ${S.hideKcal ? 'checked' : ''} onchange="setFlag('hideKcal',this.checked)"> Hide calories</label><label class="f"><input type="checkbox" ${S.focus ? 'checked' : ''} onchange="setFlag('focus',this.checked)"> Focus-Friendly Mode</label><b>Allergies (hard filter)</b>${ALLERGENS.map((a) => `<label class="f"><input type="checkbox" ${S.allergies.includes(a) ? 'checked' : ''} onchange="toggleAllergy('${a}',this.checked)"> ${a}</label>`).join('')}<div class="row"><button onclick="exportData()">Export my data</button><button onclick="deleteAll()">Delete all data</button></div><p class="mu">All data stays in this browser. Photos are not uploaded or stored.</p></div>`;
  }
};

function subNote(s) {
  return s.substituteFor ? `<div class="tag">Instead of ${esc(s.substituteFor.food.n)} (contains ${s.substituteFor.allergens.join(', ')}) — similar nutrition, allergen-free.</div>` : '';
}

function draw(keepInput) {
  const m = $('#m'), y = m.scrollTop, focused = keepInput && document.activeElement?.type === 'text';
  m.innerHTML = V[tab]();
  document.querySelectorAll('nav button').forEach((b) => (b.dataset.t === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  if (keepInput) { m.scrollTop = y; if (focused) { const i = m.querySelector('input[type=text]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}

const actions = {
  goTab(t) { tab = t; if (t !== 'scan') scan = null; draw(); },
  retake() { scan = null; draw(); },
  setQuery(v) { query = v; draw(true); },
  why(codes) {
    $('#dlg').innerHTML = `<h2 style="margin-top:0;color:var(--tx)">Why am I seeing this?</h2>${codes.map((c) => `<p>• ${REASONS[c] || c} <span class="mu">(${c})</span></p>`).join('')}${S.allergies.length ? '<p>• Foods matching your allergy list are removed before ranking.</p>' : ''}<button class="p" onclick="dlg.close()">Close</button>`;
    $('#dlg').showModal();
  },
  portion(id, conf = null, corrected = 0) {
    const f = food(id);
    if (!isSafe(f, S.allergies) && !confirm(`${f.n} contains ${matchedAllergens(f, S.allergies).join(', ')}, which is on your allergy list. Log anyway?`)) return;
    $('#dlg').innerHTML = `<h2 style="margin-top:0;color:var(--tx)">${esc(f.n)}</h2><p class="mu">Portion is an estimate you choose, not measured.</p><div class="row">${Object.keys(PORTIONS).map((s) => `<button class="p" onclick="dlg.close();logIt('${id}','${s}',${conf},${corrected})">Log ${s}</button>`).join('')}</div><p class="tag">Demo values — not verified nutrition data. Sodium & micronutrients unknown (not zero).</p><button onclick="dlg.close()">Cancel</button>`;
    $('#dlg').showModal();
  },
  logIt(id, sz, conf, corrected) {
    const f = food(id);
    S.meals.push({ id, n: f.n, sz, day: dayKey(), ts: Date.now(), conf, corrected: !!corrected, src: 'dev-demo', ...scaleFood(f, sz) });
    persist(); scan = null; tab = 'today'; draw();
  },
  deleteMeal(ts) { S.meals = S.meals.filter((m) => m.ts !== ts); persist(); draw(); },
  addWater(v) { S.water += v; persist(); draw(); },
  resetWater() { S.water = 0; persist(); draw(); },
  later() { S.snooze++; persist(); alert(`OK — I’ll ease off. Snoozed ${S.snooze}× so far.`); },
  checkin(k, v) { S.checkins.push({ k, v, ts: Date.now() }); persist(); draw(); },
  setFlag(k, v) { S[k] = v; persist(); },
  toggleAllergy(a, on) { S.allergies = on ? [...new Set([...S.allergies, a])] : S.allergies.filter((x) => x !== a); persist(); },
  saveProfile() {
    const g = (i) => document.getElementById(i).value.trim(), a = g('pa'), h = g('ph'), w = g('pw'), e = [];
    if (a && !(+a >= 5 && +a <= 120)) e.push('Age must be 5–120.');
    if (h && !(+h >= 100 && +h <= 230)) e.push('Height must be 100–230 cm.');
    if (w && !(+w >= 25 && +w <= 250)) e.push('Weight must be 25–250 kg.');
    if (e.length) { document.getElementById('pe').textContent = e.join(' '); return; }
    S.profile = { name: g('pn').slice(0, 40), age: a, h, w, sex: document.getElementById('ps').value };
    if (w && !S.wlog.length) S.wlog.push({ w: +w, ts: Date.now() });
    note = 'Saved. Targets updated everywhere.'; persist(); draw();
  },
  logWeight() {
    const v = +document.getElementById('lw').value;
    if (!(v >= 25 && v <= 250)) { document.getElementById('pe')?.replaceChildren('Enter a weight between 25 and 250 kg.'); return; }
    S.wlog.push({ w: v, ts: Date.now() }); S.profile.w = String(v); note = 'Weight logged.'; persist(); draw();
  },
  ask(k) {
    const g = gaps(), w = win(), nm = S.profile.name ? S.profile.name + ' — ' : '';
    const safe = FOODS.filter((f) => isSafe(f, S.allergies) && f.ef !== 'mid').slice(0, 3).map((f) => f.n).join('; ');
    $('#ans').textContent = nm + (k === 'fibre' ? (g.fi > 0 ? `Fibre is at ${Math.round(totals().fi)} g against a target of ${T.fibre} g, so about ${Math.round(g.fi)} g remains. Fruit, ulam, dhal and vegetable-forward plates help.` : 'Fibre has reached today’s target.')
      : k === 'next' ? `Next: ${w.meal}, suggested window ${w.win}. It’s a flexible window, not a deadline.`
      : `You don’t need a perfect meal. Quick picks: ${safe}.`);
  },
  exportData() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = 'equilibra-export.json'; a.click();
  },
  deleteAll() { if (confirm('Delete all data on this device?')) { S = defaultState(); persist(); draw(); } },
  breathe() {
    const rm = matchMedia('(prefers-reduced-motion:reduce)').matches;
    $('#dlg').innerHTML = '<h2 style="margin-top:0;color:var(--tx)">Breathe</h2><div id="o" style="width:120px;height:120px;border-radius:50%;background:var(--lv);margin:16px auto;opacity:.6"></div><p id="bt" role="status" style="text-align:center;font-size:18px"></p><button onclick="stopBreath()">Stop</button>';
    $('#dlg').showModal();
    let i = 0;
    const step = () => {
      const inn = i % 2 === 0;
      $('#bt').textContent = inn ? 'Breathe in…' : 'Breathe out…';
      if (!rm) Object.assign($('#o').style, { transition: 'transform 4s ease', transform: `scale(${inn ? 1.4 : 1})` });
      if (++i > 15) actions.stopBreath();
    };
    step(); window.__bi = setInterval(step, 4000);
  },
  stopBreath() { clearInterval(window.__bi); $('#dlg').close(); },
  doScan(file) {
    if (!file) return;
    scan = { busy: true }; draw();
    const r = new FileReader();
    r.onload = () => {
      const seed = file.size % FOODS.length, ids = [0, 3, 7].map((o) => FOODS[(seed + o) % FOODS.length].id);
      setTimeout(() => { scan = { img: r.result, c: [{ id: ids[0], p: 0.62 }, { id: ids[1], p: 0.21 }, { id: ids[2], p: 0.09 }] }; draw(); }, 1200);
    };
    r.readAsDataURL(file);
  }
};
// Inline handlers in templates call these globals; kept simple on purpose (no framework).
Object.assign(window, actions, { dlg: $('#dlg') });
document.querySelectorAll('nav button').forEach((b) => (b.onclick = () => actions.goTab(b.dataset.t)));
draw();
