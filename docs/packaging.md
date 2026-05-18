# Linux Packaging Notes

Phase 1 is arranged for future `.deb`, Snap Store, and Ubuntu-friendly packaging.

## Tauri

The `tauri/` directory contains a Tauri 2 configuration with a Debian bundle target. The frontend is built into static assets and loaded by the native WebKit-based shell.

## Backend Runtime

For production packaging, run the FastAPI backend as a bundled sidecar process or user-level service bound to `127.0.0.1`. Keep it unprivileged and store user data under an XDG-compatible application data directory.

Recommended future production path:

```text
$XDG_DATA_HOME/myownrtxchat/workspace.sqlite3
```

Phase 9 now uses the production application id `lllmao` for XDG runtime data:

```text
$XDG_DATA_HOME/lllmao/database/workspace.sqlite3
$XDG_CONFIG_HOME/lllmao/settings.json
$XDG_CACHE_HOME/lllmao/embeddings
$XDG_STATE_HOME/lllmao/logs/backend.log
```

If a confined launcher reports a read-only home directory, the backend falls
back to a per-user temporary runtime base instead of failing during import.

## Constraints

- Do not bundle Ollama model weights.
- Do not install or pull Ollama models from the application.
- Do not hardcode user-specific paths.
- Keep network behavior local to `127.0.0.1` and `localhost`.
- Treat GPU telemetry as optional. Packages may include monitoring dependencies, but absence of NVIDIA, AMD, or ROCm tooling must not prevent the app from starting.
