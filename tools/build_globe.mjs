// Build globe.json: a dot grid of the world's land, each dot tagged with its
// country, plus a centroid per country. Geography only — which countries light
// up is decided in the browser from data.json, so this never needs re-running
// when the dataset changes.
//
// One-off dev dependencies (not part of the site):
//   npm i --no-save d3-geo@3 topojson-client@3 world-atlas@2
//   node tools/build_globe.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoContains, geoBounds, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const world = require("world-atlas/countries-110m.json");
const features = feature(world, world.objects.countries).features
  .filter(f => f.properties.name !== "Antarctica");

const names = features.map(f => f.properties.name);
const boxes = features.map(f => geoBounds(f));
const inBox = (b, lon, lat) => lat >= b[0][1] && lat <= b[1][1] &&
  (b[0][0] <= b[1][0] ? lon >= b[0][0] && lon <= b[1][0] : lon >= b[0][0] || lon <= b[1][0]);

// Roughly equal-area sampling: longitude step widens towards the poles.
const STEP = 1.6, dots = [];
for (let lat = -58; lat <= 80; lat += STEP) {
  const dLon = STEP / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  for (let lon = -180; lon < 180; lon += dLon) {
    const i = features.findIndex((f, k) => inBox(boxes[k], lon, lat) && geoContains(f, [lon, lat]));
    if (i >= 0) dots.push([+lon.toFixed(1), +lat.toFixed(1), i]);
  }
}

const centroids = Object.fromEntries(features.map(f =>
  [f.properties.name, geoCentroid(f).map(v => +v.toFixed(2))]));
// Too small for the 110m atlas.
centroids["Bahrain"] = [50.56, 26.07];

const out = { source: "Natural Earth 1:110m via world-atlas@2", names, dots, centroids };
writeFileSync(new URL("../globe.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(`globe.json: ${dots.length} dots, ${names.length} countries`);
