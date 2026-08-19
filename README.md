# LAWS Tracker

An interactive survey of deployed and operational **lethal autonomous weapon systems**,
classified by where human judgement drops out of the kill chain.
A National Security & Strategic Competition project for *Americans for Responsible Innovation*.

Built on Dataset V1 (compiled 27 July 2026): 86 fielded systems, 17 countries of origin,
54 operator states. Tranche 1 — broad across categories, not exhaustive within them.

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
- `data.json` — generated from `Data/LAWS_Dataset_V1.xlsx`
- `img/` — photo set, manifest, and attribution
- `tools/` — regeneration scripts

## Regenerating

Run from the repository root after the workbook or photo set changes:

```bash
python3 tools/build_data.py       # workbook  -> data.json
python3 tools/build_credits.py    # workbook  -> img/credits.json
bash    tools/build_images.sh     # originals -> img/
```

`build_images.sh` reads from `~/LAWS-photos-originals/`, which is deliberately outside
this repository. Originals are never modified.

## Local preview

`data.json` is fetched over HTTP, so the page will not work from the file system.

```bash
python3 -m http.server 8747
```

## Deploy

GitHub Pages from `main` at the repository root. Pages is currently disabled because the
repository is private on a plan without private Pages; re-enable it when the repository
goes public or the plan changes.

