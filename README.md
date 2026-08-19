# LAWS Microsite

Working title — scope and final name TBD.

A single-page static microsite. Plain HTML, CSS, and vanilla JavaScript — no build step.

## Structure

- `index.html` — all content lives here, so the page stays readable with JavaScript disabled.
- `styles.css` — design tokens at the top of the file, then layout and section styles.
- `script.js` — progressive enhancement only (nav highlighting, scroll effects).
- `img/` — image assets.
- `social/` — social card sources.

## Local preview

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## Deploy

GitHub Pages, served from `main` at the repository root. Add a `CNAME` file when a custom domain is assigned.
