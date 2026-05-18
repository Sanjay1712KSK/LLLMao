# Snap Packaging

The Snap structure is prepared for release automation and keeps classic
confinement for developer workstation paths, ROS2 workspaces, and removable
media access.

Build `.deb` artifacts first, then run:

```bash
deployment/scripts/build-snap.sh
```

No Ollama model install or model pull is performed by this package.
