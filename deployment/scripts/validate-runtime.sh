#!/usr/bin/env bash
set -euo pipefail

OLLAMA_URL="${MYOWNRTXCHAT_OLLAMA_BASE_URL:-http://localhost:11434}"
printf 'Checking Ollama at %s\n' "$OLLAMA_URL"
curl --fail --silent "$OLLAMA_URL/api/tags" >/dev/null
printf 'Ollama is reachable. Installed model list was not modified.\n'
