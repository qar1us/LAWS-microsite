#!/bin/bash
# Build web-optimized images in img/ from originals.
# Rules: correct extensions to match real content; cap long edge at 1600px;
# re-encode oversized files to JPEG; never write an output larger than its input.
#
# ADDITIVE ONLY. This script never deletes anything in img/, and by default it
# never overwrites either: an original whose web file already exists is skipped.
# Photos added straight to img/ without an original are left alone. At the end it lists:
#   - img/ photos with no original (safe, but back them up to the originals folder)
#   - slots that now exist in two formats (e.g. X-a.jpg and X-a.webp), which you
#     resolve by hand, since picking one is a judgement, not a build step
#
#   bash tools/build_images.sh            # add web files for new originals only
#   DRY_RUN=1 bash tools/build_images.sh  # show what would be written, change nothing
#   REPLACE=1 bash tools/build_images.sh  # also re-encode originals whose web file exists
#                                         # (use after swapping in a better original)
#
# macOS only (uses sips and BSD stat).
set -u
SRC=~/LAWS-photos-originals
OUT="$(cd "$(dirname "$0")/.." && pwd)/img"
MAXDIM=1600
MAXBYTES=400000
DRY=${DRY_RUN:-0}
REPLACE=${REPLACE:-0}

[ -d "$SRC" ] || { echo "Originals folder not found: $SRC" >&2; exit 1; }
mkdir -p "$OUT"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
MAP="$WORK/map.csv"
echo "original,web,action,bytes_before,bytes_after" > "$MAP"

ext_for(){ case "$1" in image/jpeg) echo jpg;; image/png) echo png;; image/webp) echo webp;;
  image/avif) echo avif;; image/bmp|image/x-ms-bmp) echo bmp;; image/gif) echo gif;; *) echo bin;; esac; }

# put SOURCE at img/NAME, or only say so in a dry run
put(){ if [ "$DRY" = "1" ]; then echo "would write img/$2"; else cp "$1" "$OUT/$2"; fi; }
skipped=0

written=" "
for f in "$SRC"/*; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  case "$base" in .*) continue;; *.*) stem="${base%.*}";; *) stem="$base";; esac
  mime=$(file -b --mime-type "$f"); cext=$(ext_for "$mime")
  [ "$cext" = "bin" ] && { echo "skip (not an image): $base" >&2; continue; }
  # Already built? Leave it unless REPLACE=1. Any format of this slot counts.
  if [ "$REPLACE" != "1" ] && ls "$OUT" | grep -qE "^$stem\.(jpg|jpeg|png|webp|avif|gif)$"; then
    for e in jpg jpeg png webp avif gif; do [ -f "$OUT/$stem.$e" ] && written="$written$stem.$e "; done
    skipped=$((skipped + 1)); continue
  fi
  bytes=$(stat -f '%z' "$f")
  dim=$(sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null | awk '/pixelWidth|pixelHeight/{print $2}' | sort -rn | head -1)
  [ -z "$dim" ] && dim=0

  needs_resize=0; [ "$dim" -gt "$MAXDIM" ] 2>/dev/null && needs_resize=1
  too_big=0;     [ "$bytes" -gt "$MAXBYTES" ] && too_big=1
  # BMP is never acceptable for the web
  is_bmp=0; [ "$cext" = "bmp" ] && is_bmp=1

  if [ $needs_resize -eq 0 ] && [ $too_big -eq 0 ] && [ $is_bmp -eq 0 ]; then
    put "$f" "$stem.$cext"; written="$written$stem.$cext "
    act="copy"; [ "$cext" != "${base##*.}" ] && act="ext-fixed"
    echo "$base,$stem.$cext,$act,$bytes,$bytes" >> "$MAP"; continue
  fi

  tmp="$WORK/_c.jpg"
  rm -f "$tmp"
  sips -s format jpeg -s formatOptions 80 -Z "$MAXDIM" "$f" --out "$tmp" >/dev/null 2>&1
  if [ -f "$tmp" ]; then
    nb=$(stat -f '%z' "$tmp")
    if [ "$nb" -lt "$bytes" ] || [ $is_bmp -eq 1 ]; then
      put "$tmp" "$stem.jpg"; written="$written$stem.jpg "
      echo "$base,$stem.jpg,converted,$bytes,$nb" >> "$MAP"; continue
    fi
  fi
  put "$f" "$stem.$cext"; written="$written$stem.$cext "
  echo "$base,$stem.$cext,kept-original,$bytes,$bytes" >> "$MAP"
done

n=$(($(wc -l < "$MAP") - 1))
[ "$DRY" = "1" ] && echo "dry run: $n file(s) would be written, nothing changed" || echo "wrote $n file(s) to img/"
[ $skipped -gt 0 ] && echo "skipped $skipped already in img/ (REPLACE=1 to re-encode them)"

# Photos in img/ that this run did not produce. They are kept, never deleted.
orphans=""
for g in "$OUT"/*; do
  [ -f "$g" ] || continue
  name=$(basename "$g")
  case "$name" in *.jpg|*.jpeg|*.png|*.webp|*.avif|*.gif) ;; *) continue;; esac
  case "$written" in *" $name "*) ;; *) orphans="$orphans  $name"$'\n';; esac
done
if [ -n "$orphans" ]; then
  echo
  echo "Kept (no original in $SRC; copy these there so the originals stay complete):"
  printf '%s' "$orphans"
fi

# Same slot in two formats: the site would show both.
dupes=$(ls "$OUT" | grep -iE '\.(jpg|jpeg|png|webp|avif|gif)$' | sed -E 's/\.[^.]+$//' | sort | uniq -d)
if [ -n "$dupes" ]; then
  echo
  echo "WARNING: these slots exist in more than one format. Remove the stale one by hand:"
  for d in $dupes; do ls "$OUT" | grep -E "^$d\.[^.]+$" | sed 's/^/  /'; done
fi
