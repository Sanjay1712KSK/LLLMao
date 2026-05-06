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

## Constraints

- Do not bundle Ollama model weights.
- Do not install or pull Ollama models from the application.
- Do not hardcode user-specific paths.
- Keep network behavior local to `127.0.0.1` and `localhost`.
