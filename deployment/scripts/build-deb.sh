#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT_DIR/deployment/scripts/build-frontend.sh"
cd "$ROOT_DIR/tauri"
npm ci
npm run tauri -- build --bundles deb
mkdir -p "$ROOT_DIR/deployment/release/artifacts"
find "$ROOT_DIR/tauri/target/release/bundle/deb" -type f -name "*.deb" -exec cp {} "$ROOT_DIR/deployment/release/artifacts/" \;
