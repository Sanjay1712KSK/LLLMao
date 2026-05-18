#!/usr/bin/env bash
set -e

echo "Starting LLLMao Workstation..."

# XDG Base Directory variables
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export LLLMAO_DATA_DIR="$XDG_DATA_HOME/lllmao"

# Ensure storage directories exist
mkdir -p "$LLLMAO_DATA_DIR"/{chroma,media,logs,settings,cache,embeddings,workspaces}

# Determine paths
if [ -n "$SNAP" ]; then
    # Running inside Snap
    BACKEND_DIR="$SNAP/backend"
    FRONTEND_BIN="$SNAP/frontend/LLLMao"
    VENV_PYTHON="$SNAP/backend/venv/bin/python"
else
    # Running locally
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    BACKEND_DIR="$SCRIPT_DIR/../../backend"
    FRONTEND_BIN="$SCRIPT_DIR/../../frontend/src-tauri/target/release/LLLMao"
    
    # Use uv or venv if available
    if [ -f "$BACKEND_DIR/.venv/bin/python" ]; then
        VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
    else
        VENV_PYTHON="python3"
    fi
fi

cd "$BACKEND_DIR"

# Cleanup function
cleanup() {
    echo "Shutting down LLLMao..."
    if [ -n "$BACKEND_PID" ]; then
        kill -TERM "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi
    exit 0
}

# Trap exit signals
trap cleanup SIGINT SIGTERM EXIT

# Start backend
echo "Starting FastAPI backend..."
$VENV_PYTHON -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait for backend health with timeout
TIMEOUT=30
echo "Waiting for backend to become healthy..."
start_time=$(date +%s)
while true; do
    if curl -s http://127.0.0.1:8000/health > /dev/null; then
        echo "Backend is healthy!"
        break
    fi
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    if [ "$elapsed" -ge "$TIMEOUT" ]; then
        echo "Error: Backend failed to start within $TIMEOUT seconds."
        exit 1
    fi
    sleep 1
done

# Launch frontend
if [ -x "$FRONTEND_BIN" ]; then
    echo "Starting Tauri frontend..."
    "$FRONTEND_BIN" "$@"
else
    echo "Warning: Frontend binary not found at $FRONTEND_BIN"
    # If running locally in dev mode, we might just be running the backend wrapper
    wait "$BACKEND_PID"
fi
