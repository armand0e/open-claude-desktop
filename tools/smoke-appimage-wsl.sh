#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(readlink -f "$(dirname "$0")/..")"
SMOKE_DIR="${TMPDIR:-/tmp}/open-claude-appimage-smoke"
ARTIFACT="$SOURCE_DIR/release/Open-Claude-0.0.1-x86_64.AppImage"

case "$SMOKE_DIR" in
  /tmp/open-claude-*) ;;
  *) echo "Refusing unsafe smoke directory: $SMOKE_DIR" >&2; exit 90 ;;
esac

rm -rf "$SMOKE_DIR"
mkdir -p "$SMOKE_DIR"
cp "$ARTIFACT" "$SMOKE_DIR/Open-Claude.AppImage"
chmod +x "$SMOKE_DIR/Open-Claude.AppImage"

cd "$SMOKE_DIR"
./Open-Claude.AppImage --appimage-extract >/dev/null

test -x squashfs-root/AppRun
test -x squashfs-root/open-claude
test -f squashfs-root/resources/app.asar
test -f squashfs-root/resources/ion-dist/index.html
test -f squashfs-root/resources/app.asar.unpacked/node_modules/node-pty/prebuilds/linux-x64/pty.node

file squashfs-root/open-claude
file squashfs-root/resources/app.asar.unpacked/node_modules/node-pty/prebuilds/linux-x64/pty.node
grep -E '^(Name|Exec|StartupWMClass|Categories)=' squashfs-root/Open-Claude.desktop
sha256sum Open-Claude.AppImage

LIBGL_ALWAYS_SOFTWARE=1 \
  node "$SOURCE_DIR/tools/smoke-packaged.mjs" "$SMOKE_DIR/squashfs-root/open-claude"

LIBGL_ALWAYS_SOFTWARE=1 \
  node "$SOURCE_DIR/tools/smoke-packaged.mjs" "$SMOKE_DIR/Open-Claude.AppImage"
