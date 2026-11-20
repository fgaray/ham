# Courses and question banks

`index.html` loads, in order:

1. `js/core.js`: helpers, the course registry and the card builders
2. the course files in `courses/`
3. `js/app.js`: the course menu, spaced-repetition scheduler and screens

| File | What it holds |
|---|---|
| `tech-pool.js` | **Generated.** The 2026-2030 Technician pool as data (`TECH_POOL`, `TECH_GROUPS`, `TECH_SUBELEMENTS`) |
| `tech.js` | Technician course definition (topics = subelements T1 to T0, exam rules), the pool cards and the randomized drills |
| `tech-notes-*.js` | Explanations (`e`) and memory hooks (`h`) for every pool question, by subelement |

## Updating the pool

When NCVEC publishes errata or a new pool, put the `.docx` in `source/` and run:

```sh
node tools/build-pool.mjs source/<file>.docx
node tools/check.mjs
```

The check fails if a question has no note or a note points to a question that no
longer exists. Question ids are the pool ids (`T1A01`), so progress carries over
for questions that keep their id.

## Adding a course (e.g. General, Element 3)

1. Generate the pool data (adapt `tools/build-pool.mjs`: the General pool uses the
   same format with `G` ids) into `courses/general-pool.js`.
2. Create `courses/general.js` calling `registerCourse({...})` with `id`, `code`,
   `name`, `title`, `order`, a new unique `storageKey`, `blurb`, `sourcesNote`,
   `topics`, `refText` and `exam` (`size`, `pass`, and optionally `need(n)` and
   `pick(cards)`). Copy `tech.js` as a template.
3. Add notes with `addNotes('general', { G1A01: { e: '…', h: '…' } })`.
4. Add the `<script>` tags to `index.html` before `js/app.js`.

The course shows up in the menu by itself, and its progress is stored separately.
Links like `…/#tech` open a course directly.

## Card types

| Builder | Use for | Notes |
|---|---|---|
| `pool({ id, topic, group, ref, q, o, ans, svg? })` | official pool questions | all options shown, shuffled; "All these choices are correct" stays last; explanation comes from `addNotes` |
| `mc({ id, topic, ref, q, a, w, explain, hook?, svg?, n? })` | one right answer | `w` is a pool; `n` (default 3) wrong answers are drawn each time |
| `multi({ id, topic, ref, q, a, w, na?, nw?, explain })` | select all that apply | draws `na` (default 4) right items and `nw` (default 3) wrong ones |
| `term(group, id, name, def, { ref, hook?, avoid? })` | glossary terms | builds "What is X?" and "Which term is this?" questions |
| `gen(id, topic, ref, () => ({ prompt, svg?, options, explain, hook? }))` | randomized drills | `options` is `[{ t, ok }]`; see the drills in `tech.js` |

Notes and explanations support `**bold**`. Never refer to an option by its letter,
because options are shuffled.
