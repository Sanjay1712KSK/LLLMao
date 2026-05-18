# Debian Packaging

LLLMao uses the Tauri Debian bundler as the primary `.deb` producer.

Build from the repository root:

```bash
deployment/scripts/build-deb.sh
```

Runtime policy:

- The package never installs Ollama models.
- The app talks only to `http://localhost:11434` for inference.
- User data is written under XDG locations such as `$XDG_DATA_HOME/lllmao`.
- GPU telemetry is optional and must not block startup.
