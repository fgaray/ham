"use strict";
/* ================================================================
   Helpers
   ================================================================ */
const $ = (s, el = document) => el.querySelector(s);
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const strip = html => html.replace(/<\/?(strong|b|i|em)>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const f1 = n => Math.round(n * 10) / 10;
const DAY = 864e5;

/* ================================================================
   Course registry
   A course file calls registerCourse({...}) once, then any number of
   files call addCards(courseId, B => {...}) to add questions and
   addNotes(courseId, {...}) to add explanations for pool questions.
   ================================================================ */
const COURSES = [];
const COURSE = {};
function registerCourse(meta) {
  const c = { exam: { size: 25, pass: 80 }, groups: {}, parts: [], notes: {}, ...meta };
  COURSES.push(c); COURSE[c.id] = c;
  return c;
}
/* src: optional label for this part (e.g. 'pool', 'drill'); stored on each card as card.src */
function addCards(courseId, fn, src) {
  const c = COURSE[courseId];
  if (!c) throw new Error(`addCards: unknown course ${courseId}`);
  c.parts.push({ fn, src });
}
/* notes: { questionId: { e: explanation, h?: memory hook } } */
function addNotes(courseId, notes) {
  const c = COURSE[courseId];
  if (!c) throw new Error(`addNotes: unknown course ${courseId}`);
  for (const id of Object.keys(notes)) if (c.notes[id]) throw new Error(`${courseId}: duplicate note ${id}`);
  Object.assign(c.notes, notes);
}

/* Builds the question bank for one course: B.pool / B.term / B.mc / B.multi / B.gen */
function buildBank(course) {
  const GROUPS = course.groups, TERMS = [], CARDS = [];
  let src = null;
  const push = card => {
    if (CARDS.some(c => c.id === card.id)) throw new Error(`${course.id}: duplicate card id ${card.id}`);
    if (!course.topics.some(t => t.id === card.topic)) throw new Error(`${course.id}: card ${card.id} has unknown topic ${card.topic}`);
    CARDS.push({ ...card, src });
  };
  const termPic = t => course.termPic && course.termPic(t);

  function distract(t, n, filter = () => true) {
    const ok = x => x.id !== t.id && filter(x) && !(t.avoid || []).includes(x.id) && !(x.avoid || []).includes(t.id);
    const same = shuffle(TERMS.filter(x => x.group === t.group && ok(x)));
    const topic = shuffle(TERMS.filter(x => x.topic === t.topic && x.group !== t.group && ok(x)));
    const rest = shuffle(TERMS.filter(x => x.topic !== t.topic && ok(x)));
    const names = new Set([t.name]);
    return [...same, ...topic, ...rest].filter(x => !names.has(x.name) && names.add(x.name)).slice(0, n);
  }
  function buildTerm(t) {
    const G = GROUPS[t.group];
    const modes = ['def', 'rev'];
    const pic = termPic(t);
    if (pic) modes.push('pic', 'pic');
    const mode = pick(modes);
    const hook = t.hook;
    const explain = `**${t.name}**: ${t.def}`;
    if (mode === 'pic') {
      const ds = distract(t, 3, x => !!termPic(x));
      return { mode, prompt: md(`What is the **highlighted** part?`), svg: pic, explain, hook,
        options: shuffle([{ t: t.name, ok: true }, ...ds.map(d => ({ t: d.name, ok: false }))]) };
    }
    const ds = distract(t, 3);
    if (mode === 'rev') {
      return { mode, prompt: `${esc(G.rev)}<blockquote>${md(t.def)}</blockquote>`, explain, hook,
        options: shuffle([{ t: t.name, ok: true }, ...ds.map(d => ({ t: d.name, ok: false }))]) };
    }
    return { mode, prompt: md(t.ask || G.ask(t.name)), explain, hook,
      options: shuffle([{ t: t.def, ok: true }, ...ds.map(d => ({ t: d.def, ok: false }))]) };
  }
  /* Options that only make sense in a fixed spot ("All these choices are correct") stay last */
  const LAST = /^(all|none) (of )?these/i;
  const shuffleKeepLast = opts => [...shuffle(opts.filter(o => !LAST.test(o.t))), ...opts.filter(o => LAST.test(o.t))];

  const B = {
    course,
    /* Official pool question: every option is always shown (shuffled), the key is fixed.
       o: options in published order, ans: letter of the right one, group: exam group
       (one question per group on the exam), svg: optional figure html. */
    pool(o) {
      const k = 'ABCD'.indexOf(o.ans);
      if (k < 0 || k >= o.o.length) throw new Error(`${course.id}: ${o.id} has bad answer key ${o.ans}`);
      push({ id: o.id, topic: o.topic, group: o.group, ref: o.ref, pool: true, build: () => {
        const note = course.notes[o.id] || {};
        return { prompt: esc(o.q), svg: o.svg, explain: note.e || `The answer is **${o.o[k]}**.`, hook: note.h,
          options: shuffleKeepLast(o.o.map((t, i) => ({ t, ok: i === k }))) };
      } });
    },
    /* Glossary term: auto-builds definition / reverse (and picture) questions */
    term(group, id, name, def, extra = {}) {
      const G = GROUPS[group];
      if (!G) throw new Error(`${course.id}: unknown term group ${group}`);
      const t = { id, group, name, def, topic: G.topic, ...extra };
      TERMS.push(t);
      push({ id: 't-' + id, topic: t.topic, ref: t.ref, build: () => buildTerm(t) });
    },
    /* Fixed multiple choice: a = correct answer, w = wrong pool (n drawn, default 3) */
    mc(o) {
      push({ id: o.id, topic: o.topic, ref: o.ref, build: () => ({
        prompt: md(o.q), svg: typeof o.svg === 'function' ? o.svg() : o.svg, explain: o.explain, hook: o.hook,
        options: shuffle([{ t: o.a, ok: true }, ...shuffle(o.w).slice(0, o.n || 3).map(t => ({ t, ok: false }))]) }) });
    },
    /* Select-all-that-apply: na drawn from a (default 4), nw drawn from w (default 3) */
    multi(o) {
      push({ id: o.id, topic: o.topic, ref: o.ref, build: () => {
        const a = shuffle(o.a).slice(0, o.na || 4), w = shuffle(o.w).slice(0, o.nw || 3);
        return { multi: true, prompt: md(o.q), explain: o.explain, hook: o.hook,
          options: shuffle([...a.map(t => ({ t, ok: true })), ...w.map(t => ({ t, ok: false }))]) };
      } });
    },
    /* Generated question: build() returns { prompt (html), svg?, options:[{t, ok}], explain, hook?, multi? } */
    gen(id, topic, ref, build) { push({ id, topic, ref, build }); },
    /* Remove cards by id, e.g. when a later source replaces a card */
    retire(...ids) { for (const id of ids) { const i = CARDS.findIndex(c => c.id === id); if (i >= 0) CARDS.splice(i, 1); } },
  };
  for (const part of course.parts) { src = part.src || null; part.fn(B); }
  course.TERMS = TERMS;
  course.CARDS = CARDS;
  course.CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
  course.TOPIC = Object.fromEntries(course.topics.map(t => [t.id, t]));
  return course;
}
