#!/bin/bash
# Stamp a fresh version onto styles.css / script.js / data.json references in both pages.
# GitHub Pages serves assets with cache-control: max-age=600, so without this a
# reviewer who loaded the page minutes earlier can see stale CSS or JS mid-demo.
# Run before committing any change to those three files.
set -eu
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M)
# sed -i.bak works with both BSD (macOS) and GNU sed; the backups are removed below.
for page in index.html landscape.html; do
  sed -i.bak -E "s|(href=\"styles\.css)(\?v=[0-9]+)?\"|\1?v=$V\"|" "$page"
  sed -i.bak -E "s|(src=\"script\.js)(\?v=[0-9]+)?\"|\1?v=$V\"|" "$page"
done
sed -i.bak -E "s|(src=\"hero\.js)(\?v=[0-9]+)?\"|\1?v=$V\"|" index.html
sed -i.bak -E "s|fetch\('data\.json(\?v=[0-9]+)?'\)|fetch('data.json?v=$V')|" script.js
rm -f index.html.bak landscape.html.bak script.js.bak
echo "stamped version $V"
grep -o 'styles.css?v=[0-9]*' index.html landscape.html
grep -o 'script.js?v=[0-9]*' index.html landscape.html
grep -o "data.json?v=[0-9]*" script.js
