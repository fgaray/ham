#!/usr/bin/env node
/* Loads the banks the way index.html does and checks them.
   Usage: node tools/check.mjs   (exits non-zero on any problem) */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => f !== 'js/app.js');

const ctx = vm.createContext({ console });
for (const f of files) vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

const problems = [];
const report = vm.runInContext(`
(() => {
  const out = [];
  for (const c of COURSES) {
    buildBank(c);
    const pool = c.CARDS.filter(x => x.pool), drills = c.CARDS.filter(x => !x.pool);
    const ids = new Set(pool.map(x => x.id));
    for (const id of Object.keys(c.notes)) if (!ids.has(id)) out.push(c.id + ': note for unknown question ' + id);
    for (const x of pool) {
      const n = c.notes[x.id];
      if (!n || !n.e) out.push(c.id + ': ' + x.id + ' has no explanation');
      if (n && /\\b(option|answer|choice) [A-D]\\b|\\b[A-D]\\)|all of the above/.test(n.e + (n.h || ''))) out.push(c.id + ': ' + x.id + ' note refers to an option letter');
    }
    for (const x of c.CARDS) for (let i = 0; i < (x.pool ? 3 : 400); i++) {
      const q = x.build();
      const ok = q.options.filter(o => o.ok).length;
      const texts = q.options.map(o => o.t);
      if (q.multi ? ok < 1 : ok !== 1) { out.push(c.id + ': ' + x.id + ' has ' + ok + ' right answers'); break; }
      if (new Set(texts).size !== texts.length) { out.push(c.id + ': ' + x.id + ' repeats an option: ' + texts.join(' | ')); break; }
      if (texts.length < 4) { out.push(c.id + ': ' + x.id + ' has only ' + texts.length + ' options: ' + texts.join(' | ')); break; }
      if (texts.some(t => /NaN|undefined|Infinity/.test(t)) || /NaN|undefined|Infinity/.test(q.prompt + q.explain)) { out.push(c.id + ': ' + x.id + ' shows NaN/undefined: ' + q.prompt); break; }
    }
    if (c.exam.pick) {
      const e = c.exam.pick(c.CARDS);
      if (e.length !== c.exam.size) out.push(c.id + ': exam has ' + e.length + ' questions, expected ' + c.exam.size);
      if (new Set(e.map(x => x.group)).size !== e.length) out.push(c.id + ': exam repeats a group');
      if (e.some(x => !x.pool)) out.push(c.id + ': exam includes a drill');
    }
    const hooks = Object.values(c.notes).filter(n => n.h).length;
    console.log(c.id + ': ' + pool.length + ' pool questions, ' + Object.keys(c.notes).length + ' explanations (' + hooks + ' with hooks), ' + drills.length + ' drills, exam ' + c.exam.size + ' (need ' + (c.exam.need ? c.exam.need(c.exam.size) : '?') + ')');
  }
  return out;
})()`, ctx);
problems.push(...report);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('ok');
