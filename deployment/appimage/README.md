# AppImage Packaging

AppImage is a secondary target generated through Tauri:

```bash
deployment/scripts/build-appimage.sh
```

The AppImage uses the same local-only runtime policy and XDG data layout as the
`.deb` package.
