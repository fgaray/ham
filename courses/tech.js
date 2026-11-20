"use strict";
/* ================================================================
   Technician Class (FCC Element 2), 2026-2030 question pool
   Question sources (each card's `ref`):
     id   : pool question id (e.g. T1A01)
     rule : FCC Part 97 section cited by the pool
     g    : pool group a randomized drill practices (e.g. T5D)
   The pool itself is in tech-pool.js (generated), explanations are in
   tech-notes-*.js, and the randomized drills are at the end of this file.
   ================================================================ */
const TECH_ICONS = { T1: '⚖️', T2: '🎙️', T3: '🌐', T4: '🎛️', T5: '⚡', T6: '🔩', T7: '📟', T8: '📶', T9: '📡', T0: '🦺' };
const TECH_GROUP_ORDER = Object.keys(TECH_GROUPS);
const TECH_PASS = 26, TECH_SIZE = 35;

registerCourse({
  id: 'tech', code: 'Tech', name: 'Technician', title: 'Technician Class', order: 2,
  storageKey: 'ham-tech-2026-v1',
  blurb: 'Element 2, the entry-level license: all amateur privileges above 30 MHz plus some HF.',
  sourcesNote: 'The official NCVEC 2026-2030 Technician pool (all 409 questions, valid 7/1/2026 to 6/30/2030), with explanations and math drills.',
  exam: {
    size: TECH_SIZE, pass: TECH_PASS / TECH_SIZE * 100,
    rule: `${TECH_SIZE} questions, one from each pool group. You need ${TECH_PASS} correct, like the real VE session.`,
    need: n => Math.ceil(n * TECH_PASS / TECH_SIZE - 1e-9),
    /* One random question from each group, in pool order (drills are never on the exam) */
    pick: cards => {
      const by = {};
      for (const c of cards) if (c.pool) (by[c.group] ||= []).push(c);
      return Object.keys(by).sort((a, b) => TECH_GROUP_ORDER.indexOf(a) - TECH_GROUP_ORDER.indexOf(b)).map(g => pick(by[g]));
    },
  },
  topics: TECH_SUBELEMENTS.map(s => ({ id: s.id, name: `${s.id} · ${s.name}`, icon: TECH_ICONS[s.id] || '📻', onExam: s.exam })),
  refText: r => {
    const parts = [];
    if (r.id) parts.push(`Pool ${r.id}`);
    if (r.rule) parts.push(`FCC rules §${r.rule.replace(/,\s*/g, ', §')}`);
    if (r.g) parts.push(`Drill for pool group ${r.g}: ${TECH_GROUPS[r.g]}`);
    return parts.join(' · ');
  },
});

/* ================================================================
   The official pool
   ================================================================ */
addCards('tech', ({ pool }) => {
  const FIG = {
    1: { w: 900, h: 749, alt: 'Figure T-1: schematic with a resistor (1), transistor (2), lamp (3), battery (4) and ground (5)' },
    2: { w: 900, h: 419, alt: 'Figure T-2: power supply schematic with components numbered 1 to 10' },
    3: { w: 848, h: 1016, alt: 'Figure T-3: schematic with components numbered 1 to 4' },
  };
  const figure = q => {
    const m = /figure T-(\d)/i.exec(q);
    if (!m || !FIG[m[1]]) return undefined;
    const f = FIG[m[1]];
    return `<img class="pic" src="img/figure-t${m[1]}.png" width="${f.w}" height="${f.h}" alt="${esc(f.alt)}">`;
  };
  for (const q of TECH_POOL) {
    pool({ id: q.id, topic: q.id.slice(0, 2), group: q.id.slice(0, 3), ref: { id: q.id, rule: q.rule }, q: q.q, o: q.o, ans: q.ans, svg: figure(q.q) });
  }
}, 'pool');

/* ================================================================
   Randomized drills (numbers change every time). Never on the mock exam.
   ================================================================ */
addCards('tech', ({ gen }) => {
  /* Up to 10 significant digits, no float noise, US grouping: 1500 -> "1,500" */
  const fmt = n => Number(Number(n).toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 10 });
  const wrongs = (right, cands, n = 3) => {
    const out = [];
    for (const c of shuffle(cands)) if (c !== right && !out.includes(c)) out.push(c);
    return out.slice(0, n);
  };
  /* "1 watt", "2 watts" */
  const unit = (n, one, many) => `${fmt(n)} ${Number(n.toPrecision(10)) === 1 ? one : many}`;
  const opts = (right, wrong) => shuffle([{ t: right, ok: true }, ...wrong.map(t => ({ t, ok: false }))]);

  /* ---------- Ohm's law ---------- */
  const OHMS = [2, 4, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 240, 300, 500, 1000];
  const AMPS = [0.1, 0.2, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 10];
  gen('g-ohm', 'T5', { g: 'T5D' }, () => {
    let R, I, E;
    do { R = pick(OHMS); I = pick(AMPS); E = Number((R * I).toPrecision(10)); } while (E > 1000 || E < 1 || !Number.isInteger(E * 10));
    const want = pick(['E', 'I', 'R']);
    const V = x => unit(x, 'volt', 'volts'), A = x => unit(x, 'ampere', 'amperes'), O = x => unit(x, 'ohm', 'ohms');
    let prompt, right, cands, work;
    if (want === 'E') {
      prompt = `What is the voltage across a **${fmt(R)}-ohm** resistor if a current of **${fmt(I)} amperes** flows through it?`;
      right = V(E); cands = [I / R, R / I, R + I, E * 10, E / 10, E * 2].map(V);
      work = `**E = I × R** = ${fmt(I)} A × ${fmt(R)} Ω = **${fmt(E)} V**`;
    } else if (want === 'I') {
      prompt = `What current flows through a **${fmt(R)}-ohm** resistor connected to **${fmt(E)} volts**?`;
      right = A(I); cands = [E * R, R / E, I * 10, I / 10, I * 2, I / 2].map(A);
      work = `**I = E ÷ R** = ${fmt(E)} V ÷ ${fmt(R)} Ω = **${fmt(I)} A**`;
    } else {
      prompt = `What is the resistance of a circuit in which a current of **${fmt(I)} amperes** flows when connected to **${fmt(E)} volts**?`;
      right = O(R); cands = [E * I, I / E, R * 10, R / 10, R * 2, R / 2].map(O);
      work = `**R = E ÷ I** = ${fmt(E)} V ÷ ${fmt(I)} A = **${fmt(R)} Ω**`;
    }
    return { prompt: md(prompt), options: opts(right, wrongs(right, cands)),
      explain: `${work}. Ohm’s law ties voltage (E, volts), current (I, amperes) and resistance (R, ohms) together.`,
      hook: 'Draw the triangle: E on top, I × R below. Cover the one you want and the other two show the math.' };
  });

  /* ---------- Power ---------- */
  const VOLTS = [5, 6, 9, 12, 13.8, 24, 28, 48, 120, 240];
  const AMPS_P = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 8, 10, 20];
  gen('g-power', 'T5', { g: 'T5C' }, () => {
    const E = pick(VOLTS), I = pick(AMPS_P), P = Number((E * I).toPrecision(10));
    const want = pick(['P', 'P', 'I', 'E']);
    const W = x => unit(x, 'watt', 'watts'), A = x => unit(x, 'ampere', 'amperes'), V = x => unit(x, 'volt', 'volts');
    let prompt, right, cands, work;
    if (want === 'P') {
      prompt = `How much power is used by a circuit drawing **${fmt(I)} amperes** from a **${fmt(E)}-volt** supply?`;
      right = W(P); cands = [E / I, I / E, E + I, P * 10, P / 10, P * 2, P / 2].map(W);
      work = `**P = E × I** = ${fmt(E)} V × ${fmt(I)} A = **${fmt(P)} W**`;
    } else if (want === 'I') {
      prompt = `How much current does a **${fmt(P)}-watt** load draw from a **${fmt(E)}-volt** supply?`;
      right = A(I); cands = [P * E, E / P, I * 10, I / 10, I * 2, I / 2].map(A);
      work = `**I = P ÷ E** = ${fmt(P)} W ÷ ${fmt(E)} V = **${fmt(I)} A**`;
    } else {
      prompt = `A **${fmt(P)}-watt** device draws **${fmt(I)} amperes**. What is the supply voltage?`;
      right = V(E); cands = [P * I, I / P, E * 10, E / 10, E * 2, E / 2].map(V);
      work = `**E = P ÷ I** = ${fmt(P)} W ÷ ${fmt(I)} A = **${fmt(E)} V**`;
    }
    return { prompt: md(prompt), options: opts(right, wrongs(right, cands)),
      explain: `${work}. Power in watts is volts times amperes.`,
      hook: 'P = I × E: “PIE”. A 13.8 V radio drawing 10 A uses 138 W.' };
  });

  /* ---------- Metric prefixes ---------- */
  const PREFIX = { p: [-12, 'pico'], n: [-9, 'nano'], 'µ': [-6, 'micro'], m: [-3, 'milli'], '': [0, ''], k: [3, 'kilo'], M: [6, 'mega'], G: [9, 'giga'] };
  const QTY = [
    { unit: 'hertz', sym: 'Hz', pre: ['', 'k', 'M', 'G'], vals: [1.5, 3.525, 7.125, 14.2, 28.4, 146.52, 446, 1270, 500, 2.4] },
    { unit: 'amperes', sym: 'A', pre: ['µ', 'm', ''], vals: [1.5, 0.5, 2.5, 250, 47, 0.02, 15] },
    { unit: 'volts', sym: 'V', pre: ['µ', 'm', '', 'k'], vals: [1.5, 3.3, 13.8, 0.5, 500, 2.2, 120] },
    { unit: 'farads', sym: 'F', pre: ['p', 'n', 'µ'], vals: [100, 0.01, 4.7, 22, 470, 1500, 0.1] },
    { unit: 'watts', sym: 'W', pre: ['m', '', 'k'], vals: [1.5, 500, 0.25, 100, 2.5, 50] },
  ];
  const pname = (p, unit) => (PREFIX[p][1] + unit);
  gen('g-prefix', 'T5', { g: 'T5B' }, () => {
    const Q = pick(QTY);
    const i = rnd(Q.pre.length - 1);
    const pair = Math.random() < 0.5 ? [Q.pre[i], Q.pre[i + 1]] : [Q.pre[i + 1], Q.pre[i]];
    const [from, to] = pair;
    const x = pick(Q.vals), step = PREFIX[from][0] - PREFIX[to][0];
    const val = Number((x * 10 ** step).toPrecision(10));
    const unitTo = `${to}${Q.sym}`;
    const right = `${fmt(val)} ${unitTo}`;
    const cands = [x * 10 ** -step, val * 1000, val / 1000, val * 10, val / 10].map(v => `${fmt(v)} ${unitTo}`);
    const bigger = step > 0;
    return { prompt: md(`How many **${pname(to, Q.unit)}** is **${fmt(x)} ${from}${Q.sym}**?`), options: opts(right, wrongs(right, cands)),
      explain: `${(PREFIX[from][1] || 'the base unit').replace(/^./, ch => ch.toUpperCase())} is ${10 ** Math.abs(step)} times ${bigger ? 'larger' : 'smaller'} than ${PREFIX[to][1] || 'the base unit'}, so ${bigger ? 'multiply' : 'divide'} by ${fmt(10 ** Math.abs(step))}: ${fmt(x)} ${from}${Q.sym} = **${right}**.`,
      hook: 'Prefixes go p, n, µ, m, (unit), k, M, G, each a step of 1000. Smaller unit, bigger number.' };
  });

  /* ---------- Decibels ---------- */
  const DB = [[3, 2], [6, 4], [10, 10], [13, 20], [20, 100], [-3, 0.5], [-6, 0.25], [-10, 0.1]];
  const BASE_W = [1, 2, 5, 10, 20, 25, 50, 100];
  const dbTxt = d => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)} dB`;
  gen('g-db', 'T5', { g: 'T5B' }, () => {
    const [d, ratio] = pick(DB);
    const p1 = pick(BASE_W.filter(w => Number.isInteger(w * ratio * 4))), p2 = Number((p1 * ratio).toPrecision(10));
    const how = d === 3 || d === -3 ? `${d > 0 ? 'doubling' : 'halving'} is 3 dB`
      : d === 6 || d === -6 ? `${d > 0 ? 'doubling twice (×4)' : 'halving twice (÷4)'} is 3 + 3 = 6 dB`
        : d === 13 ? '×10 is 10 dB and another ×2 adds 3 dB, so ×20 is 13 dB'
          : d === 20 ? '×10 is 10 dB, and ×10 again adds another 10 dB'
            : `${d > 0 ? '×10' : '÷10'} is 10 dB`;
    if (Math.random() < 0.5) {
      const right = dbTxt(d);
      const cands = DB.map(x => dbTxt(x[0])).concat([dbTxt(-d), dbTxt(ratio > 1 ? ratio : -1 / ratio)]);
      return { prompt: md(`What is the approximate change in decibels of a power ${d > 0 ? 'increase' : 'decrease'} from **${fmt(p1)} watts** to **${fmt(p2)} watts**?`),
        options: opts(right, wrongs(right, cands)),
        explain: `The power ${d > 0 ? 'goes up' : 'goes down'} by a factor of ${fmt(d > 0 ? ratio : 1 / ratio)}. ${how[0].toUpperCase() + how.slice(1)}, so the change is **${right}**.`,
        hook: '3 dB = twice the power, 10 dB = ten times. Decibels add when the ratios multiply.' };
    }
    const W = x => unit(x, 'watt', 'watts'), right = W(p2);
    const cands = DB.map(x => W(p1 * x[1])).concat([W(p1 + d), W(p1 * Math.abs(d))]);
    return { prompt: md(`A **${fmt(p1)}-watt** signal ${d > 0 ? 'gains' : 'loses'} **${Math.abs(d)} dB**. About how much power is that?`),
      options: opts(right, wrongs(right, cands)),
      explain: `${how[0].toUpperCase() + how.slice(1)}, so ${fmt(p1)} W ${d > 0 ? '×' : '÷'} ${fmt(d > 0 ? ratio : 1 / ratio)} = **${right}**.`,
      hook: '3 dB = twice the power, 10 dB = ten times. Decibels add when the ratios multiply.' };
  });

  /* ---------- Series and parallel resistors ---------- */
  const PAIRS = [[100, 100], [60, 30], [120, 60], [6, 3], [12, 6], [20, 5], [30, 15], [100, 25], [150, 75], [40, 10], [50, 50], [200, 200]];
  gen('g-resist', 'T5', { g: 'T5D' }, () => {
    const [a, b] = shuffle(pick(PAIRS)), series = Math.random() < 0.5;
    const par = a * b / (a + b), tot = series ? a + b : par;
    const right = `${fmt(tot)} ohms`;
    const cands = [a + b, par, Math.abs(a - b), a * b, (a + b) / 2, Math.max(a, b), Math.min(a, b)].filter(x => x > 0).map(x => `${fmt(x)} ohms`);
    return { prompt: md(`What is the total resistance of a **${a}-ohm** and a **${b}-ohm** resistor connected in **${series ? 'series' : 'parallel'}**?`),
      options: opts(right, wrongs(right, cands)),
      explain: series
        ? `In **series** the resistances simply add: ${a} + ${b} = **${right}**. The same current flows through both.`
        : `In **parallel** the total is less than the smallest one: (${a} × ${b}) ÷ (${a} + ${b}) = ${a * b} ÷ ${a + b} = **${right}**. Both share the same voltage.`,
      hook: 'Series adds up. Parallel is always smaller than the smallest resistor (two equal ones give half).' };
  });

  /* ---------- Wavelength from frequency ---------- */
  const FREQS = [3.55, 7.1, 14.2, 21.1, 28.4, 50.1, 52.5, 146, 147, 223.5, 440, 446, 915, 1270];
  const len = m => m >= 1 ? `about ${fmt(+(m >= 10 ? m.toFixed(0) : m.toFixed(1)))} meters` : `about ${fmt(Math.round(m * 100))} centimeters`;
  gen('g-wave', 'T3', { g: 'T3B' }, () => {
    const f = pick(FREQS), w = 300 / f;
    const right = len(w);
    const cands = [w * 2, w / 2, w * 10, w / 10, w * 4, f / 300 * 100].map(len);
    return { prompt: md(`What is the approximate wavelength of a radio signal at **${fmt(f)} MHz**?`), options: opts(right, wrongs(right, cands)),
      explain: `**Wavelength (meters) = 300 ÷ frequency (MHz)** = 300 ÷ ${fmt(f)} ≈ ${fmt(+w.toPrecision(3))} m, so **${right}**. The higher the frequency, the shorter the wavelength.`,
      hook: '300 ÷ MHz = meters. 146 MHz → about 2 m, which is why it is called the 2-meter band.' };
  });

  /* ---------- Bands and their edges ---------- */
  const BANDS = [
    { name: '10-meter band', lo: 28, hi: 29.7, near: [27.5, 29.9, 30.2], step: 0.005 },
    { name: '6-meter band', lo: 50, hi: 54, near: [49.5, 54.5, 55], step: 0.005 },
    { name: '2-meter band', lo: 144, hi: 148, near: [143.5, 148.5, 149], step: 0.005 },
    { name: '1.25-meter band', lo: 222, hi: 225, near: [225.5, 226, 227], step: 0.01 },
    { name: '70-centimeter band', lo: 420, hi: 450, near: [415, 455, 460], step: 0.025 },
    { name: '33-centimeter band', lo: 902, hi: 928, near: [900, 930, 935], step: 0.1 },
    { name: '23-centimeter band', lo: 1240, hi: 1300, near: [1230, 1310, 1320], step: 1 },
  ];
  const inBand = b => { const n = Math.round((b.hi - b.lo) / b.step); return Number((b.lo + b.step * (1 + rnd(n - 1))).toFixed(3)); };
  const mhz = f => `${fmt(f)} MHz`;
  const edges = b => `The **${b.name}** runs from **${fmt(b.lo)} to ${fmt(b.hi)} MHz**.`;
  gen('g-band', 'T1', { g: 'T1B' }, () => {
    const b = pick(BANDS);
    if (Math.random() < 0.5) {
      const f = inBand(b);
      const right = b.name, w = wrongs(right, BANDS.map(x => x.name));
      return { prompt: md(`Which amateur band is **${mhz(f)}** in?`), options: opts(right, w),
        explain: `${edges(b)} ${mhz(f)} falls inside it.`,
        hook: '300 ÷ MHz gives the wavelength that names the band: 300 ÷ 146 ≈ 2 m.' };
    }
    const f = inBand(b);
    const others = shuffle([...b.near.map(x => ({ f: x, why: `just outside the ${b.name}` })),
      ...BANDS.filter(x => x !== b).map(x => ({ f: inBand(x), why: x.name }))]).slice(0, 3);
    return { prompt: md(`Which of these frequencies is in the **${b.name}**?`),
      options: opts(mhz(f), others.map(o => mhz(o.f))),
      explain: `${edges(b)} Only **${mhz(f)}** is inside it. ${others.map(o => `${mhz(o.f)}: ${o.why}`).join('; ')}.` };
  });

  /* ---------- Antenna length ---------- */
  const ANT = [[28.4, '10-meter'], [50.1, '6-meter'], [52.5, '6-meter'], [146, '2-meter'], [223.5, '1.25-meter'], [440, '70-centimeter']];
  gen('g-antlen', 'T9', { g: 'T9A' }, () => {
    const [f, band] = pick(ANT), half = Math.random() < 0.6;
    const k = half ? 5616 : 2808, inch = k / f;
    const fmtIn = x => `about ${fmt(Math.round(x))} inches`;
    const right = fmtIn(inch);
    const cands = [inch * 2, inch / 2, inch * 4, inch * 1.5, 11811 / f / (half ? 2 : 4) * 2.4].map(fmtIn);
    return { prompt: md(`About how long is a **${half ? 'half-wave dipole' : 'quarter-wave vertical'}** for **${fmt(f)} MHz** (${band} band)?`),
      options: opts(right, wrongs(right, cands)),
      explain: half
        ? `A half-wave dipole is about **468 ÷ MHz feet**, which is 5616 ÷ MHz inches: 5616 ÷ ${fmt(f)} ≈ **${fmt(Math.round(inch))} inches**.`
        : `A quarter-wave vertical is about **234 ÷ MHz feet**, which is 2808 ÷ MHz inches: 2808 ÷ ${fmt(f)} ≈ **${fmt(Math.round(inch))} inches**.`,
      hook: 'Half-wave dipole ≈ 468 ÷ MHz feet; quarter wave is half that, 234 ÷ MHz. Higher frequency, shorter antenna.' };
  });
}, 'drill');
