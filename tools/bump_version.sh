#!/bin/bash
# Stamp a fresh version onto styles.css / script.js / data.json references.
# GitHub Pages serves assets with cache-control: max-age=600, so without this a
# reviewer who loaded the page minutes earlier can see stale CSS or JS mid-demo.
# Run before committing any change to those three files.
set -eu
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M)
sed -i '' -E "s|(href=\"styles\.css)(\?v=[0-9]+)?\"|\1?v=$V\"|" index.html
sed -i '' -E "s|(src=\"script\.js)(\?v=[0-9]+)?\"|\1?v=$V\"|" index.html
sed -i '' -E "s|fetch\('data\.json(\?v=[0-9]+)?'\)|fetch('data.json?v=$V')|" script.js
echo "stamped version $V"
grep -o 'styles.css?v=[0-9]*' index.html
grep -o 'script.js?v=[0-9]*' index.html
grep -o "data.json?v=[0-9]*" script.js
