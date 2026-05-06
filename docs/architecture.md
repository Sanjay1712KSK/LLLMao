# Architecture

MyOwnRTXChat is a local UI and workspace layer for already-installed Ollama models.

## Boundaries

The application does not install, download, bundle, redistribute, or manage model files. It does not perform cloud inference. All inference requests go through the local Ollama REST API at `http://localhost:11434`.

## Components

- `frontend/`: React, Vite, Tailwind CSS, Zustand.
- `backend/`: FastAPI, SQLAlchemy, SQLite, Ollama REST orchestration.
- `database/`: local SQLite runtime storage.
- `tauri/`: Tauri desktop shell and future Linux packaging configuration.

## Phase 2 Monitoring

The backend exposes `/stats` through a modular system monitor. CPU and RAM metrics use `psutil`. NVIDIA telemetry uses optional `pynvml` when available. AMD telemetry is attempted through `rocm-smi` when present. If GPU telemetry is unavailable, GPU fields return `null` and the app continues in CPU-only mode.

Frontend polling is intentionally lightweight:

- `/stats` every 1 second
- `/health` every 5 seconds

Polling intervals are owned by a Zustand store and cleaned up when the app unmounts.

## Startup Flow

1. Launch the desktop shell or browser dev frontend.
2. Frontend calls backend `/health`.
3. Backend checks `GET http://localhost:11434/api/tags`.
4. Frontend loads `/models`, `/chats`, and the active chat messages.
5. User chats with a selected already-installed model through `/chat`.

## GPU Compatibility

There is no CUDA, ROCm, NVIDIA, or AMD specific code. Ollama owns inference and hardware selection. This app only orchestrates requests and renders the workspace.
