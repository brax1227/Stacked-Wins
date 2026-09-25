#!/usr/bin/env bash
# Make the Linux Swift toolchain available, so the app's Foundation-only slice
# can be tested in a cloud session without a Mac.
#
# Registered as a SessionStart hook in .claude/settings.json. Idempotent: on a
# container that already has the toolchain it does nothing but export PATH.
#
# COST, because it is not small: the toolchain is a 784 MB download that
# unpacks to about 2.5 GB, and on a cold container this takes a few minutes
# during which the session does not start. Every session after that in the same
# container is instant. Nothing here is needed for CI -- the macOS runner has
# its own Xcode -- and nothing here ships in the app.
set -euo pipefail

SWIFT_RELEASE=swift-6.0.3-RELEASE
SWIFT_BUILD=ubuntu24.04
NAME="$SWIFT_RELEASE-$SWIFT_BUILD"
ROOT="${SWIFT_TOOLCHAIN_DIR:-$HOME/.local/share/swift}"
HOME_DIR="$ROOT/$NAME"

# A toolchain already on PATH is somebody's deliberate choice; leave it alone.
if command -v swiftc >/dev/null 2>&1; then
  echo "session-start: swiftc already on PATH ($(command -v swiftc)); nothing to do"
  exit 0
fi

if [ ! -x "$HOME_DIR/usr/bin/swiftc" ]; then
  # Only in a cloud session. A laptop with Xcode needs none of this, and a
  # 784 MB download is not a thing to do to someone's machine uninvited.
  if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
    echo "session-start: no swiftc, and not a remote session -- skipping the download." >&2
    echo "               Install a toolchain from swift.org, or run tests on macOS." >&2
    exit 0
  fi

  URL="https://download.swift.org/${SWIFT_RELEASE,,}/${SWIFT_BUILD//./}/$SWIFT_RELEASE/$NAME.tar.gz"
  echo "session-start: installing $NAME (784 MB, a few minutes, once per container)"
  mkdir -p "$ROOT"
  TARBALL=$(mktemp "${TMPDIR:-/tmp}/swift-XXXXXX.tar.gz")
  trap 'rm -f "$TARBALL"' EXIT

  if ! curl -fsSL --retry 3 --retry-delay 2 -o "$TARBALL" "$URL"; then
    echo "session-start: could not download $URL" >&2
    echo "               The Swift slice will be unavailable; macOS CI still runs everything." >&2
    exit 0   # a missing dev convenience must not stop the session
  fi

  # Unpack beside the final directory and move it into place, so an interrupted
  # run never leaves a half-toolchain that looks installed.
  STAGING=$(mktemp -d "$ROOT/.staging-XXXXXX")
  tar -xzf "$TARBALL" -C "$STAGING" --strip-components=1
  rm -rf "$HOME_DIR"
  mv "$STAGING" "$HOME_DIR"
fi

export PATH="$HOME_DIR/usr/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$HOME_DIR/usr/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

echo "session-start: $("$HOME_DIR/usr/bin/swiftc" --version | head -1)"
echo "session-start: run the Foundation-only tests with .claude/hooks/swift-test.sh"
