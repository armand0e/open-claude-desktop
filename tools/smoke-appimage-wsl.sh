#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(readlink -f "$(dirname "$0")/..")"
SMOKE_DIR="${TMPDIR:-/tmp}/open-claude-appimage-smoke"
VERSION="$(node -p "require('$SOURCE_DIR/package.json').version")"
ARTIFACT="$SOURCE_DIR/release/Open-Claude-${VERSION}-x86_64.AppImage"

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
test -x squashfs-root/resources/moonshine/bin/moonshine-stream
test -f squashfs-root/resources/moonshine/bin/libmoonshine.so
test -f squashfs-root/resources/moonshine/bin/libonnxruntime.so.1
test -f squashfs-root/resources/moonshine/models/medium-streaming-en/streaming_config.json

file squashfs-root/open-claude
file squashfs-root/resources/app.asar.unpacked/node_modules/node-pty/prebuilds/linux-x64/pty.node
grep -E '^(Name|Exec|StartupWMClass|Categories)=' squashfs-root/Open-Claude.desktop
sha256sum Open-Claude.AppImage

OPEN_CLAUDE_MOONSHINE_ROOT="$SMOKE_DIR/squashfs-root/resources/moonshine" \
  node "$SOURCE_DIR/tools/probe-moonshine.mjs"

LIBGL_ALWAYS_SOFTWARE=1 \
  node "$SOURCE_DIR/tools/smoke-packaged.mjs" "$SMOKE_DIR/squashfs-root/AppRun"

if [[ -n "${OPEN_CLAUDE_LIBFUSE_DIR:-}" ]]; then
  test -f "$OPEN_CLAUDE_LIBFUSE_DIR/libfuse.so.2"
  LIBGL_ALWAYS_SOFTWARE=1 \
    LD_LIBRARY_PATH="$OPEN_CLAUDE_LIBFUSE_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" \
    node "$SOURCE_DIR/tools/smoke-packaged.mjs" "$SMOKE_DIR/Open-Claude.AppImage"
elif ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then
  LIBGL_ALWAYS_SOFTWARE=1 \
    node "$SOURCE_DIR/tools/smoke-packaged.mjs" "$SMOKE_DIR/Open-Claude.AppImage"
else
  echo "AppImage native-entry smoke requires libfuse.so.2; set OPEN_CLAUDE_LIBFUSE_DIR to a user-space libfuse2 directory." >&2
  exit 92
fi
