# Dimension Converter

A single-page tool that converts 3D object dimensions (furniture, boxes, anything) between mm, cm, m, in, and ft — parsed from a single line, stacked lines, or a pasted spec table — with a live 3D scale mockup.

## Live site

Once GitHub Pages is enabled for this repo, it's served at:
`https://<your-username>.github.io/<repo-name>/`

## Local testing

No build step — it's a single static HTML file. Just open `index.html` directly in a browser, or serve the folder locally:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Structure

- `index.html` — the entire app (HTML/CSS/JS in one file, no dependencies besides Google Fonts).

## Status

Working prototype. See the project roadmap for what's left before this is a finished, stable product.
