#!/usr/bin/env bash
# Re-encodes the landing hero background into the deployable assets under
# public/videos/hero/ and prints the hashed filenames to paste into
# lib/marketing/hero-media.ts.
#
#   bash scripts/encode-hero-video.sh [source.mp4]
#
# Outputs bg-720p.<hash>.mp4 (H.264 main profile, CRF 28, audio dropped because
# the element is muted, faststart) and poster.<hash>.webp (the first frame of
# that same encode, so the poster-to-video swap is seamless).
#
# The hash is the first 8 hex chars of the file's sha256. `/videos/hero/*` is
# served with a one-year immutable Cache-Control (next.config.ts), so a changed
# file MUST get a new name; the unit test in lib/marketing/__tests__ enforces it.
set -euo pipefail

SOURCE="${1:-assets/video/hero-background-1080p-source.mp4}"
OUT_DIR="public/videos/hero"
WIDTH=1280
CRF=28
POSTER_QUALITY=60

if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg is required (brew install ffmpeg)" >&2
  exit 1
fi
if [[ ! -f "$SOURCE" ]]; then
  echo "source not found: $SOURCE" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ffmpeg -v error -y -i "$SOURCE" -an -vf "scale=${WIDTH}:-2" \
  -c:v libx264 -preset slow -crf "$CRF" -profile:v main -level 3.1 \
  -pix_fmt yuv420p -movflags +faststart "$TMP_DIR/bg.mp4"

ffmpeg -v error -y -i "$TMP_DIR/bg.mp4" -frames:v 1 \
  -c:v libwebp -quality "$POSTER_QUALITY" -compression_level 6 "$TMP_DIR/poster.webp"

short_hash() {
  shasum -a 256 "$1" | cut -c1-8
}

VIDEO_NAME="bg-720p.$(short_hash "$TMP_DIR/bg.mp4").mp4"
POSTER_NAME="poster.$(short_hash "$TMP_DIR/poster.webp").webp"

# Previous encodes are superseded: the constants can only point at one pair.
rm -f "$OUT_DIR"/bg-720p.*.mp4 "$OUT_DIR"/poster.*.webp
mv "$TMP_DIR/bg.mp4" "$OUT_DIR/$VIDEO_NAME"
mv "$TMP_DIR/poster.webp" "$OUT_DIR/$POSTER_NAME"

echo "Wrote:"
ls -l "$OUT_DIR/$VIDEO_NAME" "$OUT_DIR/$POSTER_NAME"
echo
echo "Update lib/marketing/hero-media.ts:"
echo "  HERO_VIDEO_SRC  = \"/videos/hero/$VIDEO_NAME\""
echo "  HERO_POSTER_SRC = \"/videos/hero/$POSTER_NAME\""
