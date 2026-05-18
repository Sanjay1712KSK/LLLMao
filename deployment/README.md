# Linux Deployment

This directory contains Phase 9 packaging architecture for Linux distribution.

```text
deployment/
├── deb/
├── snap/
├── appimage/
├── release/
├── scripts/
└── assets/
```

Primary targets are `.deb` and Snap. AppImage is maintained as a secondary
portable target, and the layout keeps room for future Flatpak metadata.

Release rules:

- Do not install or pull Ollama models.
- Do not bundle model weights.
- Do not add cloud inference endpoints.
- Keep inference constrained to `http://localhost:11434`.
- Store runtime data with Linux/XDG-compatible paths.
