#!/bin/bash
# Stamp a fresh version onto every local stylesheet, script and data.json reference.
# GitHub Pages serves assets with cache-control: max-age=600, so without this a
# reviewer who loaded the page minutes earlier can see stale CSS or JS mid-demo.
# Run before committing any change to the site's CSS, JS or data.
set -eu
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M)
PAGES="index.html landscape.html systems.html"
# sed -i.bak works with both BSD (macOS) and GNU sed; the backups are removed below.
for page in $PAGES; do
  sed -i.bak -E "s|(href=\"styles\.css)(\?v=[0-9]+)?\"|\1?v=$V\"|" "$page"
  sed -i.bak -E "s|(src=\"[a-z]+\.js)(\?v=[0-9]+)?\"|\1?v=$V\"|g" "$page"
  rm -f "$page.bak"
done
sed -i.bak -E "s|fetch\('data\.json(\?v=[0-9]+)?'\)|fetch('data.json?v=$V')|" script.js
rm -f script.js.bak
echo "stamped version $V"
grep -oH -E '(styles\.css|[a-z]+\.js)\?v=[0-9]+' $PAGES
grep -o "data.json?v=[0-9]*" script.js
