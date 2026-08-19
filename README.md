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

## Images

`img/` holds the web-optimized photo set (155 files, ~18 MB), derived from originals kept
outside this repository. Filenames follow the dataset identifier scheme — `<SystemID>-<slot>.<ext>`,
where slot is `a`/`b`/`c` — so images join to the dataset by system ID. There is no filename
column in the workbook; the convention *is* the join.

- `manifest.json` — systemId → image files
- `credits.json` — per-image attribution, machine-readable
- `CREDITS.md` — the same, human-readable
- `_filename-map.csv` — original → shipped filename, with before/after byte counts

**Rights:** each image carries a `status`. Only `status: include` (government, Wikimedia, or
manufacturer press material) may be rendered. `status: hold` files are stored but must not be
displayed until rights are cleared — currently 103 of 155.
