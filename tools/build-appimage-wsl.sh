#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(readlink -f "$(dirname "$0")/..")"
BUILD_DIR="${TMPDIR:-/tmp}/open-claude-appimage-build"
UI_DIR="${TMPDIR:-/tmp}/open-claude-appimage-ui"

case "$BUILD_DIR" in
  /tmp/open-claude-*) ;;
  *) echo "Refusing unsafe build directory: $BUILD_DIR" >&2; exit 90 ;;
esac
case "$UI_DIR" in
  /tmp/open-claude-*) ;;
  *) echo "Refusing unsafe UI directory: $UI_DIR" >&2; exit 91 ;;
esac

rm -rf "$BUILD_DIR" "$UI_DIR"
mkdir -p "$BUILD_DIR" "$UI_DIR" "$SOURCE_DIR/release"

tar \
  --exclude=.git \
  --exclude=node_modules \
  --exclude=release \
  --exclude=dist \
  --exclude=dist-electron \
  --exclude=reference \
  --exclude=analysis \
  --exclude=.package-assets \
  -C "$SOURCE_DIR" -cf - . | tar -C "$BUILD_DIR" -xf -

cp -a "$SOURCE_DIR/.package-assets/ion-dist/." "$UI_DIR/"

# NTFS strips the exec bit; the bundled whisper binary must stay executable
# inside the AppImage.
if [ -f "$BUILD_DIR/assets/whisper/linux/whisper-cli" ]; then
  chmod +x "$BUILD_DIR/assets/whisper/linux/whisper-cli"
fi

cd "$BUILD_DIR"
npm ci
OPEN_CLAUDE_ION_DIST="$UI_DIR" npm run dist:linux

ARTIFACT="Open-Claude-0.0.1-x86_64.AppImage"
cp -f "$BUILD_DIR/release/$ARTIFACT" "$SOURCE_DIR/release/$ARTIFACT"
sha256sum "$SOURCE_DIR/release/$ARTIFACT"
