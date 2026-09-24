# LAWS Tracker

An interactive survey of deployed and operational **lethal autonomous weapon systems**,
classified by where human judgement drops out of the kill chain.
A National Security & Strategic Competition project for *Americans for Responsible Innovation*.

Built on the dataset compiled 27 July 2026, with inclusion criteria revised August 2026:
84 systems (76 fielded; the rest tested), 15 countries of origin, 57 operator states.
Tranche 1 — broad across categories, not exhaustive within them.

Plain HTML, CSS and vanilla JavaScript. Fonts load from Google Fonts.

## Design

Dark navy instrument surface for the tracker, cool paper for the reading sections, ARI
crimson as the single signal colour. Photographs are duotoned to the navy palette through
an inline SVG filter and washed with a class-tinted gradient — 155 images drawn from roughly
80 different sources otherwise read as a scrapbook rather than a dataset. The gradient tint
is keyed to autonomy class, so the imagery carries the analytical variable.

## Structure

Single page, no build step for the site itself. Data is generated ahead of time.

- `index.html` — page structure, inline SVG icon sprite and duotone filter definitions
- `styles.css` — design tokens at the top, then sections
- `script.js` — renders everything from `data.json`; no system facts are hardcoded
- `systems.html` — the full tracker (search, filters, every system). Accepts presets such
  as `?region=Europe`, `?tier=A2`, `?domain=Sea`, `?origin=Israel`, `?combat=1`.
- `hero.js` — alternative hero treatments for review: `?hero=globe` or `?hero=units`.
- `sections.js` — compact homepage options for section 02, linking through to
  `systems.html`: `?systems=map` (region map with autoplaying timeline) or
  `?systems=classes` (by autonomy class).
- `review.js` — the switcher shown whenever `?hero=` or `?systems=` is in the URL.
  Without those parameters the homepage is unchanged.
- `globe.json` — land dot grid and country centroids for the globe hero (Natural Earth 1:110m)
- `data.json` — generated from `Data/LAWS_Tracker_Dataset.xlsx` (gitignored; pass another path as the first argument)
- `img/` — photo set, manifest, and attribution
- `tools/` — regeneration scripts

## Regenerating

Run from the repository root after the workbook or photo set changes:

```bash
python3 tools/build_data.py       # workbook  -> data.json
python3 tools/build_credits.py    # workbook  -> img/credits.json
bash    tools/build_images.sh     # originals -> img/
bash    tools/bump_version.sh     # cache-bust css/js/json refs
node    tools/build_globe.mjs     # world-atlas -> globe.json (rarely; see script header)
```

Run `bump_version.sh` before committing any change to `styles.css`, `script.js` or
`data.json`. GitHub Pages serves assets with `cache-control: max-age=600`, so without a
fresh version string a reviewer who opened the page minutes earlier can be shown stale
CSS or JS — which is exactly the wrong moment for it during a review.

`build_images.sh` reads from `~/LAWS-photos-originals/`, which is deliberately outside
this repository. Originals are never modified.

## Local preview

`data.json` is fetched over HTTP, so the page will not work from the file system.

```bash
python3 -m http.server 8747
```

## Deploy

GitHub Pages from `main` at the repository root — live at
<https://qar1us.github.io/LAWS-microsite/>. Pushing to `main` redeploys; the build
takes roughly a minute.

