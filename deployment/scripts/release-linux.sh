#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
rm -rf "$ROOT_DIR/deployment/release/artifacts"
mkdir -p "$ROOT_DIR/deployment/release/artifacts"
"$ROOT_DIR/deployment/scripts/build-deb.sh"
"$ROOT_DIR/deployment/scripts/build-appimage.sh"
printf 'Snap is prepared in deployment/snap; run build-snap.sh on a Snapcraft host.\n'
