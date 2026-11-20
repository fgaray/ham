# Ham Radio Exam Trainer

A static, single-page practice app for the FCC amateur radio **Technician
(Element 2)** exam, built on the official **2026-2030 Technician question pool**
(effective July 1, 2026 to June 30, 2030, including the February 19, 2026 errata).

- All 409 pool questions, each with an explanation, and many with a memory hook
- Spaced repetition: the questions you miss come back within a few cards, and the
  ones you know wait longer (Leitner boxes, saved in the browser)
- Randomized math drills (Ohm's law, power, metric prefixes, decibels, series and
  parallel resistors, wavelength, band edges, antenna length)
- Mock exam built like the real one: 35 questions, one from each pool group,
  26 correct to pass
- The schematic figures T-1, T-2 and T-3, keyboard shortcuts, read-aloud, dark mode,
  and progress backup and restore

It uses the same architecture as the ASA sailing trainer: no build step and no
dependencies. Open `index.html` or serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Layout

| Path | What it is |
|---|---|
| `index.html` | Page, styles and script order |
| `js/core.js` | Helpers, course registry, card builders (`pool`, `mc`, `multi`, `term`, `gen`) |
| `js/app.js` | Course menu, scheduler, practice and exam screens, settings |
| `courses/` | Question banks; see [`courses/README.md`](courses/README.md) |
| `img/` | Pool figures T-1 to T-3 (cropped from the NCVEC diagrams) |
| `source/` | The NCVEC pool `.docx` and diagram PDF the bank is generated from |
| `tools/build-pool.mjs` | Regenerates `courses/tech-pool.js` from the `.docx` (needs `pandoc`) |
| `tools/check.mjs` | Validates every bank: answer keys, notes, drills, exam picker |

The question pool is public domain, published by the NCVEC Question Pool Committee.
