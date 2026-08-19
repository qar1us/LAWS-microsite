#!/bin/bash
# Build web-optimized img/ set from originals.
# Rules: correct extensions to match real content; cap long edge at 1600px;
# re-encode oversized files to JPEG; never write an output larger than its input.
set -u
SRC=~/LAWS-photos-originals
OUT=~/LAWS-microsite/img
MAXDIM=1600
MAXBYTES=400000
rm -rf "$OUT"; mkdir -p "$OUT"
MAP=/private/tmp/claude-501/-Users-q/fe3dc1ec-d3c3-4ead-8a17-5fa92daccdad/scratchpad/map.csv
echo "original,web,action,bytes_before,bytes_after" > "$MAP"

ext_for(){ case "$1" in image/jpeg) echo jpg;; image/png) echo png;; image/webp) echo webp;;
  image/avif) echo avif;; image/bmp|image/x-ms-bmp) echo bmp;; image/gif) echo gif;; *) echo bin;; esac; }

for f in "$SRC"/*; do
  [ -f "$f" ] || continue
  base=$(basename "$f"); stem="${base%.*}"; [ "$stem" = "$base" ] || true
  case "$base" in *.*) stem="${base%.*}";; *) stem="$base";; esac
  mime=$(file -b --mime-type "$f"); cext=$(ext_for "$mime")
  bytes=$(stat -f '%z' "$f")
  dim=$(sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null | awk '/pixelWidth|pixelHeight/{print $2}' | sort -rn | head -1)
  [ -z "$dim" ] && dim=0

  needs_resize=0; [ "$dim" -gt "$MAXDIM" ] 2>/dev/null && needs_resize=1
  too_big=0;     [ "$bytes" -gt "$MAXBYTES" ] && too_big=1
  # BMP is never acceptable for the web
  is_bmp=0; [ "$cext" = "bmp" ] && is_bmp=1

  if [ $needs_resize -eq 0 ] && [ $too_big -eq 0 ] && [ $is_bmp -eq 0 ]; then
    cp "$f" "$OUT/$stem.$cext"
    act="copy"; [ "$cext" != "${base##*.}" ] && act="ext-fixed"
    echo "$base,$stem.$cext,$act,$bytes,$bytes" >> "$MAP"; continue
  fi

  tmp="/private/tmp/claude-501/-Users-q/fe3dc1ec-d3c3-4ead-8a17-5fa92daccdad/scratchpad/_c.jpg"
  rm -f "$tmp"
  sips -s format jpeg -s formatOptions 80 -Z "$MAXDIM" "$f" --out "$tmp" >/dev/null 2>&1
  if [ -f "$tmp" ]; then
    nb=$(stat -f '%z' "$tmp")
    if [ "$nb" -lt "$bytes" ] || [ $is_bmp -eq 1 ]; then
      cp "$tmp" "$OUT/$stem.jpg"
      echo "$base,$stem.jpg,converted,$bytes,$nb" >> "$MAP"; continue
    fi
  fi
  cp "$f" "$OUT/$stem.$cext"
  echo "$base,$stem.$cext,kept-original,$bytes,$bytes" >> "$MAP"
done
