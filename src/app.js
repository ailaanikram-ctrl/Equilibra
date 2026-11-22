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
let tab = 'today', scan = null, query = '', pending = null, toastTimer = null, enterTimer = null, scanToken = 0;
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

/* ---------- motion helpers ---------- */
const PREV = {}; // last rendered value per animated element, so changes animate from where they were
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const raf = (f) => (globalThis.requestAnimationFrame || ((g) => setTimeout(g, 16)))(f);
const prev = (key) => PREV[key] ?? 0;
const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const num = (key, to) => `<span class="num" data-count data-key="${key}" data-to="${to}">${Math.round(prev(key))}</span>`;
function countUp(el) {
  const key = el.dataset.key, to = +el.dataset.to, from = +(PREV[key] ?? 0);
  PREV[key] = to;
  if (from === to || reduced()) { el.textContent = Math.round(to); return; }
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 700), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (k < 1) raf(step);
  };
  raf(step);
}
function animateIn() {
  const m = $('#m'), els = [...m.querySelectorAll('[data-anim]')], counts = [...m.querySelectorAll('[data-count]')];
  counts.forEach(countUp);
  raf(() => raf(() => {
    for (const el of els) {
      const to = clamp01(+el.dataset.to), p = el.dataset.prop;
      if (p === 'width') el.style.width = to * 100 + '%';
      else if (p === 'height') el.style.height = to * 100 + '%';
      else el.style.strokeDashoffset = String(+el.dataset.len * (1 - to));
      PREV[el.dataset.key] = to;
    }
  }));
}
function burst() {
  if (reduced()) return;
  $('#fx').innerHTML = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.5, d = 70 + Math.random() * 70;
    return `<i class="leaf" style="--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d - 30)}px;--rot:${Math.round(Math.random() * 360)}deg"></i>`;
  }).join('');
  setTimeout(() => { $('#fx').innerHTML = ''; }, 1200);
}

/* ---------- presentational helpers ---------- */
const head = (title, sub = '', action = '', eyebrow = '') =>
  `<header class="page-head"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${action}</header>`;
const section = (t) => `<h2>${t}</h2>`;
const initial = () => { const ch = [...S.profile.name.trim()][0]; return ch ? esc(ch.toUpperCase()) : ''; };
const avatar = () => `<button class="avatar" onclick="goTab('profile')" aria-label="Open profile">${initial() || icon('user', 20)}</button>`;
const tile = (f) => `<div class="tile t${FOODS.indexOf(f) % 6}" aria-hidden="true">${icon('bowl', 22)}</div>`;
const SIZE = { S: 'Small', M: 'Medium', L: 'Large' };

function bar(key, pct, color) {
  return `<div class="bar" aria-hidden="true"><i data-anim data-key="${key}" data-prop="width" data-to="${clamp01(pct)}" style="width:${prev(key) * 100}%;background:${color}"></i></div>`;
}
function ringSvg(items) {
  const size = 148, c = size / 2, w = 11, gap = 5;
  const label = items.map((i) => `${i.label} ${Math.round(clamp01(i.v / i.t) * 100)} percent`).join(', ');
  return `<svg class="rings" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}">${items.map((it, i) => {
    const r = c - w / 2 - 2 - i * (w + gap), len = +(2 * Math.PI * r).toFixed(2), key = `ring-${it.key}`;
    return `<circle class="rg-track" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}"/><circle class="rg-val" data-anim data-key="${key}" data-prop="dash" data-len="${len}" data-to="${clamp01(it.v / it.t)}" cx="${c}" cy="${c}" r="${r}" stroke="${it.c}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${len}" style="stroke-dashoffset:${len * (1 - prev(key))}" transform="rotate(-90 ${c} ${c})"/>`;
  }).join('')}</svg>`;
}
const macros = (f) => `${S.hideKcal ? '' : f.k + ' kcal · '}Protein ${f.p} g · Fibre ${f.fi} g · Carbs ${f.c} g · Fat ${f.f} g`;
const row = (f, btn, extra = '') => `<div class="item">${tile(f)}<div class="item-main"><div class="item-name">${esc(f.n)}</div><div class="meta">${macros(f)}</div>${extra}</div>${btn}</div>`;
const logBtn = (id, label = 'Log') => `<button class="btn-primary" onclick="portion('${id}')" aria-label="${label} ${esc(food(id).n)}">${label}</button>`;
const subNote = (s) => s.substituteFor
  ? `<div class="callout">Swapped in for <b>${esc(s.substituteFor.food.n)}</b> (contains ${list(s.substituteFor.allergens)}). Similar nutrition, allergen-free.</div>` : '';
const mini = (s) => `<article class="mini"><div class="mini-top">${tile(s.food)}${s.substituteFor ? '<span class="badge brand">Allergen-free swap</span>' : ''}</div><div class="item-name">${esc(s.food.n)}</div><div class="meta">Protein ${s.food.p} g · Fibre ${s.food.fi} g</div><div style="margin-top:12px"><button class="btn-primary btn-block" onclick="portion('${s.food.id}')" aria-label="Log ${esc(s.food.n)}">Log</button></div></article>`;

const MEALS = [
  { k: 'Breakfast', short: 'Breakfast', s: 7, e: 10, w: '7:30–9:00 AM' },
  { k: 'Lunch', short: 'Lunch', s: 12, e: 15, w: '12:30–1:30 PM' },
  { k: 'Tea-time snack', short: 'Tea', s: 16, e: 18, w: '4:00–5:00 PM' },
  { k: 'Dinner', short: 'Dinner', s: 19, e: 22, w: '7:00–8:30 PM' }
];
function win() {
  const h = new Date().getHours(), n = MEALS.find((w) => h < w.e) || MEALS[0];
  return { meal: n.k, win: n.w, soon: h >= n.s - 1 && h < n.e };
}
function mealRail() {
  const hrs = S.meals.filter((m) => m.day === dayKey()).map((m) => new Date(m.ts).getHours()), now = win();
  return `<div class="mrail" role="list" aria-label="Meals today">${MEALS.map((m) => {
    const done = hrs.some((h) => h >= m.s - 1 && h < m.e), cur = !done && m.k === now.meal;
    return `<div class="mstep${done ? ' done' : ''}${cur ? ' now' : ''}" role="listitem" aria-label="${m.short}: ${done ? 'logged' : cur ? 'up next' : 'not logged'}"><div class="mdot">${done ? icon('check', 18) : '<i></i>'}</div>${m.short}</div>`;
  }).join('')}</div>`;
}
function weekStrip() {
  const logged = new Set(S.meals.map((m) => m.day));
  return `<div class="week" role="group" aria-label="Last 7 days">${Array.from({ length: 7 }, (_, n) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - n));
    const k = dayKey(d), on = logged.has(k), full = d.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' });
    return `<div class="day${n === 6 ? ' today' : ''}" role="img" aria-label="${full}${n === 6 ? ', today' : ''}${on ? ', meals logged' : ''}"><span>${d.toLocaleDateString('en-MY', { weekday: 'narrow' })}</span><b>${d.getDate()}</b><i class="dd${on ? ' on' : ''}"></i></div>`;
  }).join('')}</div>`;
}
function hydration() {
  const pct = clamp01(S.water / T.water), left = Math.max(0, T.water - S.water);
  return `<div class="card hydro"><div class="glass" role="img" aria-label="Water ${S.water} of ${T.water} millilitres"><div class="glass-fill" data-anim data-key="glass" data-prop="height" data-to="${pct}" style="height:${prev('glass') * 100}%"><svg class="wave" viewBox="0 0 240 12" preserveAspectRatio="none" aria-hidden="true"><path d="M0 6 Q15 0 30 6 T60 6 T90 6 T120 6 T150 6 T180 6 T210 6 T240 6 V12 H0Z"/></svg></div></div>
<div><div class="big">${num('water', S.water)} <span class="mu">ml</span></div><div class="mu">${left > 0 ? `${left} ml to go · target ${T.water} ml` : 'Target reached. Nicely done.'}</div>
<div class="row"><button class="btn-primary" onclick="addWater(250)">${icon('plus', 16)} 250</button><button onclick="addWater(500)">${icon('plus', 16)} 500</button><button class="btn-ghost" onclick="resetWater()">Reset</button></div></div></div>`;
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
    const t = totals(), n = nba(), w = win(), g = gaps(), hr = new Date().getHours(), meals = S.meals.filter((m) => m.day === dayKey()).length;
    const name = S.profile.name.trim();
    const gr = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (name ? `, ${esc(name)}` : '');
    const date = new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' });
    const hero = `<section class="hero${S.focus ? ' big' : ''}" aria-labelledby="nba-t"><span class="hero-leaf" aria-hidden="true">${icon('leaf', 120)}</span><div class="eyebrow">${icon(n.a === 'water' ? 'droplet' : 'sparkle', 16)}Next best action</div>
<h2 id="nba-t" class="hero-title">${S.focus && n.a === 'eat' ? `Eat ${w.meal.toLowerCase()}` : n.t}</h2>
<div class="row">${n.a === 'water' ? '<button class="btn-primary" onclick="addWater(250)">Add 250 ml water</button>' : ''}${n.a === 'eat' ? '<button class="btn-primary" onclick="goTab(\'nutrition\')">What should I eat?</button>' : ''}<button class="btn-ghost" onclick='why(${JSON.stringify(n.r)})'>Why this?</button></div></section>`;
    const header = head(gr, '', avatar(), date);
    const sg = suggest(FOODS, g, S.allergies, S.focus ? 3 : 5);
    if (S.focus) {
      return `${header}${hero}${section('Quick options')}<div class="card list">${sg.map((s) => row(s.food, `<button class="btn-primary" onclick="portion('${s.food.id}')">Done</button>`, subNote(s))).join('') || '<div class="empty">No suggestion available with your current allergy list.</div>'}</div>`;
    }
    const items = [{ key: 'protein', label: 'Protein', v: t.p, t: T.protein, u: 'g', c: 'var(--protein)' }, { key: 'fibre', label: 'Fibre', v: t.fi, t: T.fibre, u: 'g', c: 'var(--fibre)' }];
    if (!S.hideKcal) items.push({ key: 'energy', label: 'Energy', v: t.k, t: T.kcal, u: 'kcal', c: 'var(--energy)' });
    const legend = items.map((i) => { const left = Math.round(i.t - i.v); return `<div class="lg"><span class="sw" style="background:${i.c}"></span><div><b>${i.label}</b><div class="mu">${Math.round(i.v)} / ${i.t} ${i.u}</div></div><span class="rem${left > 0 ? '' : ' done'}">${left > 0 ? `${left} ${i.u} left` : 'Done'}</span></div>`; }).join('');
    return `${header}${weekStrip()}${hero}
${section('Today’s balance')}<div class="card"><div class="balance"><div class="ring-wrap">${ringSvg(items)}<div class="ring-center"><b>${num('meals', meals)}</b><span>${meals === 1 ? 'meal' : 'meals'}</span></div></div><div class="legend">${legend}</div></div>
<p class="fine">Incomplete isn’t bad, it’s just what’s left for the day. ${T.src === 'profile' ? 'Targets are estimated from your profile (development formula, not clinical advice).' : 'Targets are default demo values. Add your profile to personalise them.'}</p></div>
${section('Meal rhythm')}<div class="card">${mealRail()}<div class="row sp"><div><div class="card-title">${w.meal}</div><div class="mu">Suggested ${w.win}</div></div><div class="row"><button class="btn-primary" onclick="remind()">Remind me</button><button class="btn-ghost" onclick="later()">Later</button></div></div></div>
${section('Hydration')}${hydration()}
${section('Try next')}<div class="rail" aria-label="Meal ideas">${sg.map(mini).join('') || '<div class="empty">No suggestion available with your current allergy list.</div>'}</div>`;
  },

  nutrition() {
    const q = query.trim().toLowerCase(), found = FOODS.filter((f) => f.n.toLowerCase().includes(q)), sg = suggest(FOODS, gaps(), S.allergies, 4);
    const todayMeals = S.meals.filter((m) => m.day === dayKey()).sort((a, b) => a.ts - b.ts), t = totals();
    const mt = t.p + t.c + t.f || 1;
    const avoiding = S.allergies.length ? `<div class="badges"><span class="mu">Avoiding</span>${S.allergies.map((a) => `<span class="badge warn">${a}</span>`).join('')}</div>` : '';
    const macro = todayMeals.length
      ? `<div class="macrobar" role="img" aria-label="Protein ${t.p} g, carbs ${t.c} g, fat ${t.f} g"><i data-anim data-key="mp" data-prop="width" data-to="${t.p / mt}" style="width:${prev('mp') * 100}%;background:var(--protein)"></i><i data-anim data-key="mc" data-prop="width" data-to="${t.c / mt}" style="width:${prev('mc') * 100}%;background:var(--energy)"></i><i data-anim data-key="mf" data-prop="width" data-to="${t.f / mt}" style="width:${prev('mf') * 100}%;background:var(--water)"></i></div>
<div class="macros3"><div><b>${num('gp', t.p)} g</b><span>Protein</span></div><div><b>${num('gc', t.c)} g</b><span>Carbs</span></div><div><b>${num('gf', t.f)} g</b><span>Fat</span></div></div>`
      : '<div class="empty">Log a meal to see today’s protein, carbs and fat split.</div>';
    return `${head('Nutrition', 'Log what you eat and see what’s left for today.')}
${section('Today’s macros')}<div class="card">${macro}</div>
${section('What should I eat?')}<div class="card">${avoiding}<div class="list">${sg.map((s) => row(s.food, logBtn(s.food.id), subNote(s))).join('') || '<div class="empty">No suggestion available with your current allergy list.</div>'}</div>
<p class="fine">Allergen tags in this prototype are demo data. Always check real ingredients.</p></div>
${section('Find a food')}<div class="searchbox">${icon('search', 18)}<input type="text" placeholder="Search Malaysian foods" value="${esc(query)}" oninput="setQuery(this.value)" aria-label="Search foods" autocomplete="off"></div>
<div class="card list">${found.map((f) => {
      if (isSafe(f, S.allergies)) return row(f, logBtn(f.id));
      const alts = substitutesFor(f, S.allergies, FOODS, { limit: 2 }).map((a) => esc(a.food.n)).join(' · ');
      return row(f, '<button disabled>Blocked</button>', `<div class="callout warn">Contains ${list(matchedAllergens(f, S.allergies))}.${alts ? ` Similar: ${alts}` : ''}</div>`);
    }).join('') || '<div class="empty">No match. Try another name. Equilibra won’t invent a record.</div>'}</div>
${section('Today’s meals')}<div class="card list">${todayMeals.map((m) => `<div class="item">${tile(food(m.id) || FOODS[0])}<div class="item-main"><div class="item-name">${esc(m.n)}</div><div class="meta"><span class="time">${new Date(m.ts).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}</span> · ${SIZE[m.sz]} · Protein ${m.p} g · Fibre ${m.fi} g${m.src === 'dev-demo' ? ' · demo value' : ''}${m.conf ? ` · scan ${Math.round(m.conf * 100)}%` : ''}</div></div><button class="btn-ghost" onclick="deleteMeal(${m.ts})" aria-label="Remove ${esc(m.n)}">Remove</button></div>`).join('') || '<div class="empty">No meals logged yet. Scan a meal or search above to begin.</div>'}</div>`;
  },

  scan() {
    if (!scan) {
      const picker = (cls, label, cap) => `<label class="btn ${cls}">${label}<input class="sr-only" type="file" accept="image/*" ${cap ? 'capture="environment"' : ''} onchange="doScan(this.files[0])"></label>`;
      return `${head('Scan a meal', 'Take a photo and confirm what it is.')}
<div class="viewfinder" aria-hidden="true"><span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span><div class="beam"></div>${icon('bowl', 84)}</div>
<div class="row" style="justify-content:center;margin-bottom:16px">${picker('btn-primary', `${icon('scan', 18)} Take photo`, true)}${picker('', 'Choose photo', false)}</div>
<div class="notice"><span>Development mock: this recognizer is not a trained model. It proposes placeholder candidates so the review and logging flow can be tested. Always confirm. Photos stay on your device.</span></div>
<button class="btn-block" onclick="goTab('nutrition')">Search for a food instead</button>`;
    }
    if (scan.busy) return `${head('Analysing', 'Mock provider: no real recognition is happening.')}<div class="shot"><img class="photo" src="${scan.img}" alt="Your meal photo"><div class="beam"></div></div>
<div class="card"><div class="row"><div class="spinner" aria-hidden="true"></div><span id="scanStatus" role="status">Preparing photo…</span></div><div class="prog" aria-hidden="true"><i></i></div></div>`;
    return `${head('Review', 'Pick the closest match, or search if none fit.')}<div class="shot"><img class="photo" src="${scan.img}" alt="Your meal photo"></div>
${section('Best guesses')}${scan.c.map((c, i) => {
      const f = food(c.id), ok = isSafe(f, S.allergies), pct = Math.round(c.p * 100);
      return `<div class="card"><div class="row sp"><div class="row" style="flex-wrap:nowrap">${tile(f)}<div class="card-title">${esc(f.n)}</div></div><span class="badge${i ? '' : ' brand'}">${i ? 'Alternative' : 'Best match'}</span></div>
<div class="conf" role="img" aria-label="Confidence ${pct} percent"><i data-anim data-key="conf${i}" data-prop="width" data-to="${c.p}" style="width:0"></i></div>
<div class="mu">${c.p > 0.6 ? 'Fairly likely' : 'Possible'} · ${pct}% confidence (mock)</div>
${ok ? '' : `<div class="callout warn">Contains ${list(matchedAllergens(f, S.allergies))}, which is on your allergy list.</div>`}
<div style="margin-top:12px"><button class="btn-primary btn-block" onclick="portion('${c.id}',${c.p},${i ? 1 : 0})">This is right</button></div></div>`;
    }).join('')}
<div class="card"><div class="card-title">None of these</div><p class="mu">I couldn’t confidently identify this meal. Search for the dish instead.</p><button onclick="goTab('nutrition')">Search the dish</button></div>
<button class="btn-ghost btn-block" onclick="retake()">Retake photo</button>`;
  },

  health() {
    const kinds = ['Energy', 'Focus', 'Mood'];
    const soon = (ic, title, text) => `<div class="card empty-card"><div class="ic">${icon(ic, 22)}</div><div><div class="card-title">${title}</div><div class="mu">${text}</div></div><span class="badge">Not connected</span></div>`;
    return `${head('Health', 'Context that supports your nutrition. Everything here is optional.')}
${section('Hydration')}${hydration()}
${section('Quick check-in')}<div class="card">${kinds.map((k) => `<div class="scale-row"><div class="row sp"><b>${k}</b><span class="mu">1 low · 5 high</span></div><div class="scale" role="group" aria-label="${k}">${[1, 2, 3, 4, 5].map((n) => `<button aria-pressed="${latestCheckin(k) === n}" aria-label="${k} ${n} of 5" onclick="checkin('${k}',${n})">${n}</button>`).join('')}</div></div>`).join('')}
<p class="fine">Skip any you like. ${S.checkins.length} check-in${S.checkins.length === 1 ? '' : 's'} stored on this device.</p></div>
${section('Activity and sleep')}${soon('steps', 'Steps', 'Connect a health app to see activity here.')}${soon('moon', 'Sleep', 'Sleep summaries appear once a provider is connected.')}
${section('Body')}<div class="card row sp"><div><div class="card-title">${S.profile.w ? `${esc(S.profile.w)} kg` : 'Not set'}</div><div class="mu">${S.profile.w ? `Hydration target ${T.water} ml` : 'Add your weight to personalise hydration.'}</div></div><button onclick="goTab('profile')">Open profile</button></div>
${section('Reset')}<div class="card empty-card"><div class="mini-orb" aria-hidden="true"></div><div><div class="card-title">One-minute breathing</div><div class="mu">A slow guided pause.</div></div><button onclick="breathe()">Start</button></div>`;
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
  animateIn();
  if (keepInput) {
    m.scrollTop = y;
    if (focused) { const i = m.querySelector('input[type=text]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
}
function enterView() {
  const m = $('#m'); m.classList.add('enter');
  clearTimeout(enterTimer); enterTimer = setTimeout(() => m.classList.remove('enter'), 1100);
}
function toast(msg) {
  const t = $('#toast'); t.innerHTML = `${icon('check', 16)}<span>${esc(msg)}</span>`; t.classList.add('show');
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
<div class="seg">${Object.entries(PORTIONS).map(([s, m]) => { const x = scaleFood(f, s); return `<button onclick="logIt('${id}','${s}',${conf},${corrected})"><span>${SIZE[s]}</span><small>×${m} · ${S.hideKcal ? '' : x.k + ' kcal · '}${x.p} g protein</small></button>`; }).join('')}</div>
<p class="fine">Demo values, not verified nutrition data. Sodium and micronutrients are unknown, not zero.</p><div class="row end"><button onclick="closeSheet()">Cancel</button></div>`);
}

/* ---------- actions (called from inline handlers) ---------- */
const actions = {
  goTab(t) { const changed = t !== tab; tab = t; if (t !== 'scan') scan = null; if (changed) enterView(); draw(); if (changed) $('#m').scrollTop = 0; },
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
    persist(); scan = null; $('#dlg').close(); tab = 'today'; enterView(); draw(); $('#m').scrollTop = 0; toast('Meal logged. Today’s totals updated.'); burst();
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
    const text = nm ? nm + msg[0].toLowerCase() + msg.slice(1) : msg, box = $('#ans');
    box.innerHTML = '<span class="typing" role="status" aria-label="Thinking"><i></i><i></i><i></i></span>';
    setTimeout(() => { const b = $('#ans'); if (b) b.textContent = text; }, reduced() ? 0 : 550);
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
    const token = ++scanToken, alive = () => scan && scan.token === token && tab === 'scan';
    const r = new FileReader();
    r.onerror = () => { scan = null; draw(); toast('Couldn’t read that photo. Try another, or search for the food.'); };
    r.onload = () => {
      scan = { busy: true, img: r.result, token }; enterView(); draw();
      const seed = file.size % FOODS.length, ids = [0, 3, 7].map((o) => FOODS[(seed + o) % FOODS.length].id);
      const say = (txt) => { const e = $('#scanStatus'); if (e && alive()) e.textContent = txt; };
      setTimeout(() => say('Looking for dishes…'), 600);
      setTimeout(() => say('Matching to the food list…'), 1250);
      setTimeout(() => {
        if (!alive()) return;
        scan = { img: r.result, token, c: [{ id: ids[0], p: 0.62 }, { id: ids[1], p: 0.21 }, { id: ids[2], p: 0.09 }] };
        enterView(); draw();
      }, 1950);
    };
    r.readAsDataURL(file);
  }
};

/* ---------- boot ---------- */
Object.assign(window, actions);
const NAV = [['today', 'Today', 'home'], ['nutrition', 'Nutrition', 'utensils'], ['scan', 'Scan', 'scan'], ['health', 'Health', 'activity'], ['coach', 'Coach', 'message']];
$('#nav').innerHTML = NAV.map(([t, l, i]) => (t === 'scan'
  ? `<button class="nav-scan" data-t="scan" aria-label="Scan a meal">${icon(i, 26)}</button>`
  : `<button data-t="${t}"><span class="ni">${icon(i)}</span><span>${l}</span></button>`)).join('');
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) actions.goTab(b.dataset.t); });
$('#dlg').addEventListener('close', () => { clearInterval(window.__bi); pending = null; });
enterView();
draw();
