"use strict";
/* ================================================================
   App: course menu, persistence, scheduler and views.
   Course banks are registered before this file loads (see courses/).
   ================================================================ */
COURSES.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
for (const c of COURSES) buildBank(c);

/* ---------- Preferences shared by all courses ---------- */
const PREFS_KEY = 'ham-trainer-prefs';
const PREF_DEFAULTS = { theme: 'auto', sound: false, scale: 1, course: null };
const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
function cleanPrefs(p) {
  const out = { ...PREF_DEFAULTS, ...p };
  if (!['auto', 'light', 'dark'].includes(out.theme)) out.theme = 'auto';
  if (!Number.isFinite(out.scale)) out.scale = 1;
  out.sound = out.sound === true;
  if (!COURSE[out.course]) out.course = null;
  return out;
}
const loadPrefs = () => cleanPrefs(readJSON(PREFS_KEY) || {});
let P = loadPrefs();
const savePrefs = () => writeJSON(PREFS_KEY, P);

/* ---------- Per-course progress ----------
   settings.off lists the topics the learner switched off, so topics added
   to a course later are on by default. */
const stateDefaults = () => ({ cards: {}, turn: 0, xp: 0, streak: 0, lastDay: null, bestRun: 0, settings: { sprint: 10, off: [] } });
function normalizeState(d, course) {
  const s = Object.assign(stateDefaults(), d || {});
  const ds = (d && d.settings) || {};
  s.settings = { sprint: [5, 10, 20].includes(ds.sprint) ? ds.sprint : 10, off: Array.isArray(ds.off) ? ds.off : [] };
  // Older saves stored the topics that were ON
  if (!Array.isArray(ds.off) && Array.isArray(ds.topics)) s.settings.off = course.topics.map(t => t.id).filter(id => !ds.topics.includes(id));
  s.settings.off = s.settings.off.filter(id => course.TOPIC[id]);
  s.cards = Object.fromEntries(Object.entries(s.cards || {}).filter(([, c]) => c && Number.isFinite(c.box) && Number.isFinite(c.due)));
  return s;
}
const validState = raw => raw && typeof raw.cards === 'object' && raw.cards !== null && Number.isFinite(raw.turn);
const loadState = course => normalizeState(readJSON(course.storageKey), course);

let C = null, S = null; // current course, its progress
function save() {
  if (C) writeJSON(C.storageKey, S);
}
function selectCourse(id) {
  if (C) save();
  C = COURSE[id]; S = loadState(C);
  P.course = id; savePrefs();
  document.title = `${C.title} Exam Trainer`;
  try { history.replaceState(null, '', '#' + C.code); } catch (e) { /* file:// or sandbox */ }
}
const courseFromHash = () => { const h = location.hash.replace('#', '').toLowerCase(); return COURSES.find(c => c.code.toLowerCase() === h || c.id === h); };

/* ---------- Scheduler (Leitner-style, turn-based with day backstop) ---------- */
const TURN_GAP = [3, 6, 12, 25, 50, 100, 200];
const DAY_GAP = [0, 0, 1, 3, 7, 14, 30];
const MASTERED = 4;
const st = id => S.cards[id];
function isDue(s) {
  if (!s) return false;
  if (S.turn >= s.due) return true;
  return s.box >= 2 && (Date.now() - s.last) / DAY >= DAY_GAP[s.box];
}
const topicOn = id => !S.settings.off.includes(id);
const activeCards = () => C.CARDS.filter(c => topicOn(c.topic));

function pickNext(pool, lastId) {
  const seen = pool.filter(c => st(c.id) && c.id !== lastId);
  const unseen = pool.filter(c => !st(c.id));
  const due = seen.filter(c => isDue(st(c.id)));
  const struggling = due.filter(c => st(c.id).box === 0);
  const takeNew = unseen.length && !struggling.length && (due.length === 0 || Math.random() < 0.4);
  if (due.length && !takeNew) {
    const ranked = due.map(c => ({ c, k: st(c.id).box * 10 - (S.turn - st(c.id).due) + Math.random() * 4 })).sort((a, b) => a.k - b.k);
    return ranked[0].c;
  }
  if (unseen.length) {
    const recent = new Set(sess.recentTopics.slice(-2));
    const fresh = unseen.filter(c => !recent.has(c.topic));
    return pick(fresh.length ? fresh : unseen);
  }
  const rest = (seen.length ? seen : pool).slice().sort((a, b) => (st(a.id)?.due ?? 0) - (st(b.id)?.due ?? 0) + (Math.random() - .5) * 6);
  return rest[0];
}
/* g: 0 again, 1 hard, 2 good, 3 easy */
function grade(id, g) {
  S.turn++;
  const s = S.cards[id] || { box: 0, due: 0, seen: 0, right: 0, wrong: 0, last: 0 };
  s.seen++; s.last = Date.now();
  if (g === 0) { s.wrong++; s.box = 0; s.due = S.turn + TURN_GAP[0]; }
  else {
    s.right++;
    if (g === 1) s.box = Math.max(1, s.box - 1);
    if (g === 2) s.box = Math.min(6, s.box + 1);
    if (g === 3) s.box = Math.min(6, s.box + 2);
    s.due = S.turn + Math.round(TURN_GAP[s.box] * (g === 3 ? 1.5 : 1));
  }
  S.cards[id] = s;
}
function topicStats(tid) {
  const cs = C.CARDS.filter(c => c.topic === tid);
  let m = 0, l = 0;
  for (const c of cs) { const s = st(c.id); if (!s) continue; if (s.box >= MASTERED) m++; else l++; }
  return { total: cs.length, m, l };
}
function courseStats(course) {
  const s = course === C ? S : loadState(course);
  let m = 0, l = 0;
  for (const c of course.CARDS) { const x = s.cards[c.id]; if (!x) continue; if (x.box >= MASTERED) m++; else l++; }
  return { total: course.CARDS.length, m, l, xp: s.xp, started: Object.keys(s.cards).length > 0 };
}
/* Exam questions: the course may pick them (e.g. one per pool group); drills never count */
const examItems = pool => C.exam.pick ? C.exam.pick(pool) : shuffle(pool).slice(0, Math.min(C.exam.size, pool.length));
const examNeed = n => C.exam.need ? C.exam.need(n) : Math.ceil(n * C.exam.pass / 100);
function touchStreak() {
  const today = new Date().toDateString();
  if (S.lastDay === today) return;
  const y = new Date(Date.now() - DAY).toDateString();
  S.streak = S.lastDay === y ? S.streak + 1 : 1;
  S.lastDay = today;
}

/* ================================================================
   Feedback effects
   ================================================================ */
let actx = null;
function tone(ok) {
  if (!P.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = ok ? [660, 880] : [300, 240];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = actx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.2);
    });
  } catch (e) { /* audio unavailable */ }
}
function toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; (dlg.open ? dlg : document.body).appendChild(d); setTimeout(() => d.remove(), 2300); }
function xpFloat(n) { const d = document.createElement('div'); d.className = 'xp'; d.textContent = `+${n} XP`; document.body.appendChild(d); setTimeout(() => d.remove(), 1000); }
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div'); box.className = 'confetti';
  const cols = ['#2457d6', '#e8830c', '#1d8549', '#d2372b', '#f2c230'];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw'; p.style.background = pick(cols);
    p.style.animationDelay = Math.random() * 0.3 + 's'; p.style.animationDuration = 1 + Math.random() * 0.8 + 's';
    box.appendChild(p);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 2200);
}
function speak(text) {
  if (!('speechSynthesis' in window)) return toast('Read-aloud is not supported in this browser');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; speechSynthesis.speak(u);
}

/* ================================================================
   Views
   ================================================================ */
const app = $('#app'), bar = $('#bar');
let view = 'home', sess = null, cur = null;

function applySettings() {
  const r = document.documentElement;
  if (P.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', P.theme);
  r.style.setProperty('--scale', P.scale);
}
const refText = r => (r && C.refText ? C.refText(r) : '');
const logo = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 22 L20 60 M32 22 L44 60 M24 48 L40 48 M27 38 L37 38" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="32" cy="18" r="5" fill="var(--primary)"/><path d="M20 8 A16 16 0 0 0 20 28 M44 8 A16 16 0 0 1 44 28" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`;

function header() {
  return `<header class="app"><h1><button class="coursebtn" data-act="courses" aria-label="Change course (current: ${esc(C.title)})">${logo}
      <span class="code">${esc(C.name)}</span><span class="cname hide-sm">Exam Trainer</span><span class="caret" aria-hidden="true">▾</span></button></h1>
    <span class="pill" title="Days in a row">🔥 ${S.streak}</span>
    <span class="pill hide-sm" title="Experience points">⭐ ${S.xp}</span>
    <button class="iconbtn" data-act="settings" aria-label="Settings">⚙️</button></header>`;
}

function renderCourses() {
  view = 'courses'; bar.innerHTML = '';
  document.title = 'Ham Radio Exam Trainer';
  app.innerHTML = `<header class="app"><h1><span class="coursebtn static">${logo}<span class="code">Ham Radio Exam Trainer</span></span></h1>
    ${C ? '<button class="iconbtn" data-act="home" aria-label="Back">✕</button>' : ''}</header>
  <section class="card hero">
    <h2>Choose your course</h2>
    <p>Each course keeps its own progress. You can switch at any time from the course name at the top.</p>
  </section>
  <div class="courses">
    ${COURSES.map((c, i) => { const s = courseStats(c); const isCur = C === c;
      return `<button class="course" data-act="pickCourse" data-id="${c.id}" ${isCur ? 'aria-current="true"' : ''}>
        <span class="badge" aria-hidden="true">${c.code}</span>
        <span class="info"><span class="nm">${esc(c.title)}</span>
          <span class="bl">${esc(c.blurb || '')}</span>
          <span class="bar"><i class="m" style="width:${s.m / s.total * 100}%"></i><i class="l" style="width:${s.l / s.total * 100}%"></i></span>
          <span class="meta">${s.m}/${s.total} mastered · ${s.started ? `⭐ ${s.xp} XP` : 'not started'}</span>
          ${c.sourcesNote ? `<span class="src">📘 ${esc(c.sourcesNote)}</span>` : ''}</span>
        <span class="go" aria-hidden="true">${isCur ? '✓' : `<span class="kbd">${i + 1}</span>`}</span>
      </button>`; }).join('')}
  </div>`;
}

function renderHome() {
  view = 'home'; bar.innerHTML = '';
  document.title = `${C.title} Exam Trainer`;
  const pool = activeCards();
  const due = pool.filter(c => isDue(st(c.id))).length;
  const fresh = pool.filter(c => !st(c.id)).length;
  const mastered = C.CARDS.filter(c => (st(c.id)?.box ?? -1) >= MASTERED).length;
  const sp = S.settings.sprint, ex = C.exam;
  app.innerHTML = `${header()}
  <section class="card hero">
    <h2>Ready for a short round?</h2>
    <p>Answer one question at a time. The ones you miss come back soon, and the easy ones wait longer.</p>
    <div class="stats">
      <div class="stat"><b>${mastered}<small style="font-size:.6em;color:var(--muted)">/${C.CARDS.length}</small></b><span>mastered</span></div>
      <div class="stat"><b>${due}</b><span>due for review</span></div>
      <div class="stat"><b>${fresh}</b><span>not seen yet</span></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <span style="color:var(--ink-2);font-size:.9rem">Round length</span>
      <div class="seg" role="group" aria-label="Round length">
        ${[5, 10, 20].map(n => `<button data-act="sprint" data-n="${n}" aria-pressed="${sp === n}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="row">
      <button class="btn primary" data-act="practice" ${pool.length ? '' : 'disabled'}>▶ Start ${sp}-card round <span class="kbd">⏎</span></button>
      <button class="btn secondary" data-act="exam" ${pool.length ? '' : 'disabled'}>📝 Mock exam (${examItems(pool).length})</button>
    </div>
  </section>
  <div class="section-title">Topics: tap to include or exclude</div>
  <div class="topics">
    ${C.topics.map(t => { const s = topicStats(t.id); const on = topicOn(t.id);
      return `<button class="topic" data-act="topic" data-id="${t.id}" aria-pressed="${on}">
        <span class="ic" aria-hidden="true">${t.icon}</span>
        <span><span class="nm">${t.name}</span>
          <span class="bar"><i class="m" style="width:${s.total ? s.m / s.total * 100 : 0}%"></i><i class="l" style="width:${s.total ? s.l / s.total * 100 : 0}%"></i></span></span>
        <span style="display:flex;align-items:center;gap:10px"><span class="ct">${s.m}/${s.total}</span><span class="check" aria-hidden="true">${on ? '✓' : ''}</span></span>
      </button>`; }).join('')}
  </div>
  <div class="legend"><span><i style="background:var(--good)"></i>mastered</span><span><i style="background:var(--accent)"></i>learning</span><span><i style="background:var(--surface-2)"></i>new</span></div>
  <details class="help card" style="margin-top:20px">
    <summary>How this works & focus tips</summary>
    <ul>
      <li><b>Short rounds.</b> 5 to 10 questions, then a short break. Stopping often keeps you focused.</li>
      <li><b>Spaced repetition.</b> If you miss a question, it comes back within a few cards. If you rate it <i>Easy</i>, you won't see it for a while.</li>
      <li><b>Rate honestly.</b> If you guessed right, press <i>Hard</i> so the question comes back sooner.</li>
      <li><b>Keyboard:</b> <span class="kbd">1</span>–<span class="kbd">4</span> to pick an answer · <span class="kbd">H</span> hint (removes two wrong answers) · <span class="kbd">S</span> show the answer · <span class="kbd">⏎</span> continue. After you answer: <span class="kbd">1</span> Hard · <span class="kbd">2</span>/<span class="kbd">⏎</span> Good · <span class="kbd">3</span> Easy.</li>
      <li><b>Mock exam:</b> ${esc(ex.rule || `${ex.size} random questions and no hints. You need ${examNeed(ex.size)} correct to pass.`)} No hints. Switching topics off leaves their groups out.</li>
      <li>The answer order is shuffled every time, so you learn the answer and not its letter. The math drills change their numbers every time and never appear on the mock exam.</li>
      ${C.sourcesNote ? `<li><b>Sources:</b> ${esc(C.sourcesNote)} Each answer shows where to read more.</li>` : ''}
      <li>Your progress is saved in this browser only. Use Settings to download a backup.</li>
    </ul>
  </details>`;
}

function startPractice() {
  touchStreak(); save();
  sess = { mode: 'practice', total: S.settings.sprint, done: 0, right: 0, marks: [], lastId: null, recentTopics: [], start: Date.now(), run: 0, xp: 0, promoted: 0 };
  next();
}
function startExam() {
  touchStreak(); save();
  const items = examItems(activeCards());
  if (!items.length) return toast('No exam questions in the selected topics');
  sess = { mode: 'exam', items, total: items.length, done: 0, right: 0, marks: [], answers: [], recentTopics: [], start: Date.now() };
  next();
}
function next() {
  if (sess.done >= sess.total) return sess.mode === 'exam' ? renderExamResult() : renderSummary();
  const card = sess.mode === 'exam' ? sess.items[sess.done] : pickNext(activeCards(), sess.lastId);
  const q = card.build();
  cur = { card, q, answered: false, sel: new Set(), gone: new Set(), hinted: false, revealed: false, ok: null };
  sess.lastId = card.id; sess.recentTopics.push(card.topic);
  renderCard();
}

function segs() {
  return Array.from({ length: sess.total }, (_, i) => {
    const m = sess.marks[i]; return `<i class="${m === true ? 'ok' : m === false ? 'no' : i === sess.done ? 'cur' : ''}"></i>`;
  }).join('');
}
function renderCard() {
  view = 'card';
  const { card, q } = cur, T = C.TOPIC[card.topic];
  const exam = sess.mode === 'exam';
  app.innerHTML = `
  <div class="topbar">
    <button class="iconbtn" data-act="quit" aria-label="End round">✕</button>
    <div class="segs" aria-hidden="true">${segs()}</div>
    <span class="count">${sess.done + 1} / ${sess.total}</span>
  </div>
  <article class="card" id="qcard" tabindex="-1" aria-labelledby="qprompt">
    <div class="qhead"><span class="chips"><span class="chip">${T.icon} ${esc(T.name)}</span>${card.pool ? `<span class="chip qid">${card.id}</span>` : '<span class="chip qid">Drill</span>'}</span>
      <span>${exam ? '<span class="chip">📝 Exam</span>' : ''}
      <button class="iconbtn" data-act="speak" aria-label="Read question aloud" title="Read aloud">🔊</button></span></div>
    <h2 class="prompt" id="qprompt">${q.prompt}</h2>
    ${q.svg ? `<div class="figure">${q.svg}</div>` : ''}
    ${q.multi ? `<div class="multi-note">☑ Select all that apply, then press Check</div>` : ''}
    <div class="opts" role="group" aria-label="Answer options">
      ${q.options.map((o, i) => `<button class="opt" data-act="opt" data-i="${i}" aria-pressed="false"><span class="key">${i + 1}</span><span class="txt">${md(o.t)}</span><span class="mark" aria-hidden="true"></span></button>`).join('')}
    </div>
    <div id="fb" aria-live="polite"></div>
  </article>`;
  ringHighlight();
  renderBar();
  $('#qcard').focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
function ringHighlight() {
  const el = $('#qcard .dia .hl'); if (!el) return;
  const b = el.getBBox(); const size = Math.max(b.width, b.height);
  if (size > 70) return;
  const r = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  r.setAttribute('class', 'ring'); r.setAttribute('cx', b.x + b.width / 2); r.setAttribute('cy', b.y + b.height / 2); r.setAttribute('r', size / 2 + 12);
  el.ownerSVGElement.appendChild(r);
}
function renderBar() {
  const exam = sess.mode === 'exam', q = cur.q;
  let html = '';
  if (!cur.answered) {
    if (exam) {
      html = `<button class="btn primary" data-act="submit" ${cur.sel.size ? '' : 'disabled'}>${sess.done + 1 === sess.total ? 'Finish' : 'Next'} <span class="kbd">⏎</span></button>`;
    } else if (q.multi) {
      html = `<button class="btn ghost" data-act="reveal">Show answer <span class="kbd">S</span></button>
        <button class="btn primary" data-act="submit" ${cur.sel.size ? '' : 'disabled'}>Check <span class="kbd">⏎</span></button>`;
    } else {
      const canHint = !cur.hinted && q.options.length >= 4;
      html = `<button class="btn ghost" data-act="hint" ${canHint ? '' : 'disabled'}>💡 Hint <span class="kbd">H</span></button>
        <button class="btn ghost" data-act="reveal">Show answer <span class="kbd">S</span></button>`;
    }
  } else if (cur.ok) {
    html = `<button class="btn hard" data-act="rate" data-g="1"><span class="stack">Hard <span class="sub">guessed · soon <span class="kbd">1</span></span></span></button>
      <button class="btn primary" data-act="rate" data-g="2" ${cur.hinted ? 'disabled' : ''}><span class="stack">Good <span class="sub">later <span class="kbd">2</span></span></span></button>
      <button class="btn easy" data-act="rate" data-g="3" ${cur.hinted ? 'disabled' : ''}><span class="stack">Easy <span class="sub">much later <span class="kbd">3</span></span></span></button>`;
  } else {
    html = `<button class="btn primary" data-act="rate" data-g="0">Got it, continue <span class="kbd">⏎</span></button>`;
  }
  bar.innerHTML = `<div class="actionbar"><div class="inner">${html}</div></div>`;
}

function choose(i) {
  if (view !== 'card' || cur.answered) return;
  const o = cur.q.options[i]; if (!o || cur.gone.has(i)) return;
  if (cur.q.multi) { cur.sel.has(i) ? cur.sel.delete(i) : cur.sel.add(i); }
  else if (sess.mode === 'exam') { cur.sel = new Set([i]); }
  else { cur.sel = new Set([i]); return evaluate(); }
  document.querySelectorAll('.opt').forEach((b, j) => { b.classList.toggle('sel', cur.sel.has(j)); b.setAttribute('aria-pressed', cur.sel.has(j)); });
  renderBar();
}
function isCorrect() {
  return cur.q.options.every((o, i) => o.ok === cur.sel.has(i));
}
function evaluate() {
  if (cur.answered) return;
  if (sess.mode === 'exam') {
    const ok = isCorrect();
    sess.answers.push({ card: cur.card, q: cur.q, sel: [...cur.sel], ok });
    sess.marks[sess.done] = null; if (ok) sess.right++;
    sess.done++;
    return next();
  }
  cur.answered = true; cur.ok = !cur.revealed && isCorrect();
  document.querySelectorAll('.opt').forEach((b, j) => {
    const o = cur.q.options[j], s = cur.sel.has(j);
    b.disabled = true;
    b.classList.remove('sel');
    if (o.ok && s) { b.classList.add('ok'); b.querySelector('.mark').textContent = '✓'; }
    else if (o.ok) { b.classList.add(cur.q.multi || cur.revealed ? 'missed' : 'ok'); b.classList.add('ok'); b.querySelector('.mark').textContent = '✓'; }
    else if (s) { b.classList.add('no'); b.querySelector('.mark').textContent = '✗'; }
  });
  sess.marks[sess.done] = cur.ok;
  if (cur.ok) {
    sess.run++; sess.right++;
    const gain = cur.hinted ? 5 : 10; S.xp += gain; sess.xp += gain; xpFloat(gain);
    if (sess.run > S.bestRun) S.bestRun = sess.run;
    if (sess.run && sess.run % 5 === 0) { toast(`🔥 ${sess.run} in a row!`); confetti(); }
  } else { sess.run = 0; S.xp += 2; sess.xp += 2; }
  tone(cur.ok);
  const praise = pick(['Nice!', 'Correct!', 'Spot on!', 'Solid copy!', 'Roger that!']);
  const title = cur.ok ? `✓ ${praise}` : cur.revealed ? 'Here\'s the answer' : 'Not quite. Here\'s the key idea:';
  const ref = refText(cur.card.ref);
  $('#fb').innerHTML = `<div class="fb ${cur.ok ? 'good' : 'bad'}"><h3>${title}</h3>
    <p>${md(cur.q.explain || '')}</p>
    ${cur.q.hook ? `<div class="hook">💡 <b>Memory hook:</b> ${md(cur.q.hook)}</div>` : ''}
    <div class="ref">📘 ${esc(ref)}${cur.ok ? '' : `${ref ? ' · ' : ''}this card will come back in a few questions`}</div></div>`;
  $('.segs').innerHTML = segs();
  renderBar();
  setTimeout(() => $('#fb')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }), 60);
  save();
}
function hint() {
  if (cur.answered || cur.hinted || cur.q.multi || sess.mode === 'exam') return;
  const wrong = shuffle(cur.q.options.map((o, i) => (!o.ok ? i : -1)).filter(i => i >= 0)).slice(0, 2);
  wrong.forEach(i => { cur.gone.add(i); const b = document.querySelectorAll('.opt')[i]; b.classList.add('gone'); b.disabled = true; });
  cur.hinted = true; renderBar();
}
function reveal() {
  if (cur.answered || sess.mode === 'exam') return;
  cur.revealed = true; evaluate();
}
function rate(g) {
  if (!cur.answered) return;
  const before = st(cur.card.id)?.box ?? -1;
  grade(cur.card.id, g);
  if (before < MASTERED && st(cur.card.id).box >= MASTERED) sess.promoted++;
  save();
  sess.done++;
  next();
}

function renderSummary() {
  view = 'summary';
  const pct = Math.round(sess.right / sess.total * 100);
  const mins = Math.max(1, Math.round((Date.now() - sess.start) / 60000));
  const msg = pct >= 90 ? 'Outstanding focus!' : pct >= 70 ? 'Solid round!' : pct >= 50 ? 'Good effort. The ones you missed will come back.' : 'Tough round, and that\'s how you learn. The ones you missed are queued up.';
  if (pct >= 80) confetti();
  save();
  app.innerHTML = `${header()}
  <section class="card center">
    <div class="big">${pct >= 80 ? '🏆' : pct >= 50 ? '📻' : '📡'}</div>
    <h2 style="margin:0">${sess.right} / ${sess.total} correct</h2>
    <p style="color:var(--ink-2)">${msg}</p>
    <div class="segs" style="margin:10px 0 16px" aria-hidden="true">${segs()}</div>
    <div class="stats">
      <div class="stat"><b>+${sess.xp}</b><span>XP earned</span></div>
      <div class="stat"><b>${sess.promoted}</b><span>newly mastered</span></div>
      <div class="stat"><b>${mins}m</b><span>focused</span></div>
    </div>
    ${mins >= 15 ? '<p style="color:var(--accent);font-weight:700">You\'ve been at it a while. A short break now will help you remember more.</p>' : ''}
    <div class="row">
      <button class="btn primary" data-act="practice">▶ Another round <span class="kbd">⏎</span></button>
      <button class="btn secondary" data-act="break">🧘 1-minute break</button>
    </div>
    <button class="btn ghost block" data-act="home" style="margin-top:8px">Back to topics</button>
  </section>`;
  bar.innerHTML = '';
}
let breakTimer = null;
function renderBreak() {
  view = 'break';
  let left = 60;
  app.innerHTML = `${header()}<section class="card center">
    <h2 style="margin:0">Micro-break</h2>
    <p style="color:var(--ink-2)">Look away from the screen. Breathe in as the circle grows and out as it shrinks. Roll your shoulders.</p>
    <div class="breathe" aria-hidden="true"></div>
    <p><b id="left">60</b> seconds</p>
    <button class="btn primary block" data-act="practice">I'm back, next round</button>
    <button class="btn ghost block" data-act="home" style="margin-top:8px">Back to topics</button></section>`;
  clearInterval(breakTimer);
  breakTimer = setInterval(() => {
    left--; const el = $('#left'); if (!el || view !== 'break') return clearInterval(breakTimer);
    el.textContent = left;
    if (left <= 0) { clearInterval(breakTimer); el.parentElement.innerHTML = '<b>Break done. Ready when you are.</b>'; tone(true); }
  }, 1000);
}
function renderExamResult() {
  view = 'result';
  const pct = Math.round(sess.right / sess.total * 100), need = examNeed(sess.total), pass = sess.right >= need;
  for (const a of sess.answers) if (!a.ok) { const s = st(a.card.id); S.turn++; S.cards[a.card.id] = { ...(s || { seen: 0, right: 0, wrong: 0 }), box: 0, due: S.turn, last: Date.now(), seen: (s?.seen || 0) + 1, wrong: (s?.wrong || 0) + 1 }; }
  S.xp += sess.right * 5; save();
  if (pass) confetti();
  const missed = sess.answers.filter(a => !a.ok);
  app.innerHTML = `${header()}
  <section class="card center">
    <div class="big">${pass ? '🎉' : '📚'}</div>
    <h2 style="margin:0">${pct}%: ${pass ? 'Pass!' : 'Not yet'}</h2>
    <p style="color:var(--ink-2)">${sess.right} of ${sess.total} correct. You need ${need} to pass. ${pass ? 'Keep passing mock exams with a margin and you\'re ready for the VE session.' : 'The questions you missed are now first in line for practice.'}</p>
    <div class="row"><button class="btn primary" data-act="practice">▶ Practice missed questions</button><button class="btn secondary" data-act="home">Home</button></div>
  </section>
  ${missed.length ? `<div class="section-title">Review: ${missed.length} missed</div><section class="card">
    ${missed.map(a => `<div class="miss"><div class="q"><span class="qid">${a.card.id}</span> ${strip(a.q.prompt)}</div>
      ${a.q.svg ? `<div class="figure" style="max-width:320px;margin-top:8px">${a.q.svg}</div>` : ''}
      <div class="y">Your answer: ${a.sel.map(i => esc(a.q.options[i].t)).join('; ') || '(none)'}</div>
      <div class="a">✓ ${a.q.options.filter(o => o.ok).map(o => esc(o.t)).join('; ')}</div>
      <p style="margin:6px 0 0;color:var(--ink-2)">${md(a.q.explain || '')}</p></div>`).join('')}
  </section>` : ''}`;
  bar.innerHTML = '';
}

/* ---------- Download / upload progress (all courses in one file) ---------- */
const BACKUP_APP = 'ham-trainer';
function exportState() {
  save();
  const courses = Object.fromEntries(COURSES.map(c => [c.id, c === C ? S : loadState(c)]));
  const blob = new Blob([JSON.stringify({ app: BACKUP_APP, version: 2, exported: new Date().toISOString(), prefs: P, courses }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ham-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Progress downloaded');
}
/* Restores a backup object; returns the number of cards loaded. Throws if nothing usable. */
function applyBackup(d) {
  const found = {};
  if (d && d.app === BACKUP_APP && d.courses) {
    for (const [id, raw] of Object.entries(d.courses)) if (COURSE[id] && validState(raw)) found[id] = raw;
  } else if (validState(d)) {
    found[C.id] = d;
  }
  if (!Object.keys(found).length) throw new Error('not a progress file');
  let n = 0;
  for (const [id, raw] of Object.entries(found)) {
    const course = COURSE[id], s = normalizeState(raw, course);
    s.cards = Object.fromEntries(Object.entries(s.cards).filter(([cid]) => course.CARD_BY_ID[cid]));
    n += Object.keys(s.cards).length;
    if (course === C) S = s; else writeJSON(course.storageKey, s);
  }
  const prefs = d.prefs || null;
  if (prefs) {
    const keep = Object.fromEntries(['theme', 'scale', 'sound'].filter(k => prefs[k] !== undefined).map(k => [k, prefs[k]]));
    P = cleanPrefs({ ...P, ...keep, course: C.id }); savePrefs();
  }
  save();
  return n;
}
function importState() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const n = applyBackup(JSON.parse(await f.text()));
      applySettings(); dlg.close(); renderHome();
      toast(`Progress loaded (${n} cards)`);
    } catch (e) { toast('That file is not a valid progress backup'); }
  });
  inp.click();
}

/* Settings dialog */
const dlg = $('#settings');
function openSettings() {
  dlg.innerHTML = `<h2>Settings</h2><div class="settings">
    <label>Theme <span class="seg">${['auto', 'light', 'dark'].map(t => `<button data-act="theme" data-v="${t}" aria-pressed="${P.theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</span></label>
    <label>Text size <span class="seg">${[[0.9, 'A−'], [1, 'A'], [1.15, 'A+'], [1.3, 'A++']].map(([v, l]) => `<button data-act="scale" data-v="${v}" aria-pressed="${P.scale === v}">${l}</button>`).join('')}</span></label>
    <label>Sound feedback <span class="seg">${[[false, 'Off'], [true, 'On']].map(([v, l]) => `<button data-act="sound" data-v="${v}" aria-pressed="${P.sound === v}">${l}</button>`).join('')}</span></label>
    <label>Progress backup (all courses) <span class="seg"><button data-act="export">Download</button><button data-act="import">Upload</button></span></label>
    <label>Reset ${esc(C.name)} progress <button class="btn secondary" data-act="reset" style="min-height:40px;padding:6px 12px">Reset</button></label>
  </div><button class="btn primary block" data-act="closeSettings" style="margin-top:14px">Done</button>`;
  if (!dlg.open) dlg.showModal();
}

/* ================================================================
   Events
   ================================================================ */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act;
  switch (a) {
    case 'courses': return renderCourses();
    case 'pickCourse': selectCourse(b.dataset.id); return renderHome();
    case 'practice': return startPractice();
    case 'exam': return startExam();
    case 'home': clearInterval(breakTimer); return renderHome();
    case 'break': return renderBreak();
    case 'sprint': S.settings.sprint = +b.dataset.n; save(); return renderHome();
    case 'topic': {
      const id = b.dataset.id, off = S.settings.off;
      S.settings.off = off.includes(id) ? off.filter(x => x !== id) : [...off, id];
      save(); return renderHome();
    }
    case 'opt': return choose(+b.dataset.i);
    case 'submit': return cur.sel.size && evaluate();
    case 'hint': return hint();
    case 'reveal': return reveal();
    case 'rate': return rate(+b.dataset.g);
    case 'speak': return speak(strip(cur.q.prompt) + '. ' + cur.q.options.map((o, i) => `Option ${i + 1}: ${o.t}`).join('. '));
    case 'quit':
      if (sess.mode === 'practice' && sess.done > 0) { sess.total = sess.done; return renderSummary(); }
      return renderHome();
    case 'settings': return openSettings();
    case 'closeSettings': dlg.close(); return view === 'home' ? renderHome() : null;
    case 'theme': P.theme = b.dataset.v; break;
    case 'scale': P.scale = +b.dataset.v; break;
    case 'sound': P.sound = b.dataset.v === 'true'; if (P.sound) tone(true); break;
    case 'export': return exportState();
    case 'import': return importState();
    case 'reset':
      if (b.dataset.confirm) { const keep = S.settings; S = stateDefaults(); S.settings = keep; save(); dlg.close(); return renderHome(); }
      b.dataset.confirm = '1'; b.textContent = 'Tap again to confirm'; return;
  }
  if (['theme', 'scale', 'sound'].includes(a)) { savePrefs(); save(); applySettings(); openSettings(); }
});
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || dlg.open) return;
  const k = e.key.toLowerCase();
  const ae = document.activeElement;
  const onButton = ae && ae.tagName === 'BUTTON' && !ae.classList.contains('opt');
  if (k === 'enter' && onButton) return;
  if (view === 'courses') {
    if (/^[1-9]$/.test(k) && COURSES[+k - 1]) { selectCourse(COURSES[+k - 1].id); return renderHome(); }
    if (k === 'escape' && C) return renderHome();
    return;
  }
  if (view === 'home' && k === 'enter') { e.preventDefault(); return activeCards().length && startPractice(); }
  if (view === 'summary' && k === 'enter') { e.preventDefault(); return startPractice(); }
  if (view !== 'card') return;
  if (!cur.answered) {
    if (/^[1-9]$/.test(k)) { e.preventDefault(); return choose(+k - 1); }
    if (k === 'h') return hint();
    if (k === 's') return reveal();
    if (k === 'enter' && cur.sel.size && (cur.q.multi || sess.mode === 'exam')) { e.preventDefault(); return evaluate(); }
  } else {
    if (!cur.ok && (k === 'enter' || k === ' ')) { e.preventDefault(); return rate(0); }
    if (cur.ok) {
      if (k === '1') return rate(1);
      if (!cur.hinted && (k === '2' || k === 'enter' || k === ' ')) { e.preventDefault(); return rate(2); }
      if (cur.hinted && (k === 'enter' || k === ' ')) { e.preventDefault(); return rate(1); }
      if (!cur.hinted && k === '3') return rate(3);
    }
  }
});
window.addEventListener('hashchange', () => {
  const c = courseFromHash();
  if (c && c !== C && (view === 'home' || view === 'courses')) { selectCourse(c.id); renderHome(); }
});

/* ---------- Start ---------- */
applySettings();
{
  const fromHash = courseFromHash();
  const start = fromHash || COURSE[P.course] || (COURSES.length === 1 ? COURSES[0] : null);
  if (start) { selectCourse(start.id); renderHome(); }
  else renderCourses();
}
