# Dimension Converter

A tool that converts 3D object dimensions (furniture, boxes, anything) between mm, cm, m, in, and ft — parsed from a single line, stacked lines, or a pasted spec table — with a live 3D scale mockup. Two files, no build step: `index.html` (the app) and `parser.js` (the parsing logic it loads).

## Live site

Once GitHub Pages is enabled for this repo, it's served at:
`https://<your-username>.github.io/<repo-name>/`

## Local testing

No build step. Open `index.html` directly in a browser (it loads `parser.js` alongside it — keep both files in the same folder), or serve the folder locally:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Structure

- `index.html` — the app shell: markup, styling, and the DOM-wiring script (rendering results, drag-to-rotate mockup, controls). No parsing logic lives here anymore.
- `parser.js` — all dimension-parsing and unit-formatting logic, as a dependency-free file that works both as a browser `<script>` (exposes `window.DimParser`) and as a Node module (`require('./parser.js')`). This is the single source of truth for what input formats are recognized — `index.html` just calls into it.
- `tests/parser.test.js` — a zero-dependency regression suite covering every input format the app is meant to handle (see `SUPPORTED-INPUTS.md`), plus every real bug found so far. Run it any time `parser.js` changes:
  ```
  node tests/parser.test.js
  ```
- `SUPPORTED-INPUTS.md` — a plain-language list of every input shape the parser recognizes, with examples. Read this to see what's supported; update it (and add a matching test case) whenever a new format is taught to the parser.

## Keeping track of what the parser recognizes

`SUPPORTED-INPUTS.md` is the human-readable list. `tests/parser.test.js` is
the machine-checkable version of the same list — every example in the doc
has a matching test. When a new input format breaks (like a real
marketplace listing did), the loop is:

1. Add a test case for the exact broken input to `tests/parser.test.js` — it should fail.
2. Fix `parser.js` until `node tests/parser.test.js` passes again.
3. Add the new format as an example in `SUPPORTED-INPUTS.md`.

That keeps every past bug permanently covered so it can't silently come back.

## Status

Working prototype. See the project roadmap for what's left before this is a finished, stable product.
