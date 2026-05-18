#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR/deployment/snap"
snapcraft pack
mkdir -p "$ROOT_DIR/deployment/release/artifacts"
find "$ROOT_DIR/deployment/snap" -maxdepth 1 -type f -name "*.snap" -exec cp {} "$ROOT_DIR/deployment/release/artifacts/" \;
