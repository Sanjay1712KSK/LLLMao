#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."

cd "$ROOT_DIR/deployment/snap"

echo "Building LLLMao Snap package..."
snapcraft clean
snapcraft

echo "Build complete."
echo "To install: sudo snap install lllmao_v1Janus-Beta_amd64.snap --classic --dangerous"
