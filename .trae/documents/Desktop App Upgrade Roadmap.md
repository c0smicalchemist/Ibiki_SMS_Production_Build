## Repo & Project Setup
- Add `desktop/` with Electron main, preload, and builder config
- Reuse built Vite UI (`dist/public`) for renderer; keep web API untouched

## Core Implementation
- Main process: create BrowserWindow, enable `contextIsolation`, `sandbox`, preload
- Preload: expose `ibiki.desktop` API (notifications, tray, secure storage, file ops)
- Renderer: detect `isDesktop` and route sensitive operations via IPC; keep web paths if not desktop

## Secure Storage
- Implement OS keychain adapters:
  - Windows DPAPI (wincred)
  - macOS Keychain
  - Linux libsecret
- Migrate JWT/provider keys from localStorage to keychain when desktop

## Updates & Packaging
- Configure electron‑builder targets: NSIS/MSIX (Windows), DMG (macOS), AppImage (Linux)
- Auto‑update via GitHub Releases (or S3); add signing/notarization hooks
- CI jobs build and publish installers; no changes to web deploy job

## Offline Cache & Sync
- Embed SQLite for inbox/messages/favorites cache
- Background worker: queued writes, reconciliation, retry/backoff; conflict resolution policy

## Native UI
- Tray icon and menu (Open Inbox, Reconcile, Pause Sync)
- Notifications for new messages/status
- Settings window (provider keys, update channel, sync, logs)

## Security & Telemetry
- Harden Electron (disable remote module, strict CSP)
- Crash reporting (Sentry), opt‑in minimal telemetry for updates

## Deliverables
- Windows `.exe` installer + auto‑updates
- macOS `.dmg` (signed/notarized)
- Linux AppImage

## Rollout
1) Scaffold desktop app and minimal Windows installer
2) Add secure storage + tray/notifications
3) Enable auto‑update + CI
4) Add offline cache + sync
5) Harden security + ship cross‑platform installers

On approval, I’ll create `desktop/` and implement the scaffold, then deliver a first Windows `.exe` for you to try.