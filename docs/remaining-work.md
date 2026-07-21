# Remaining Work

The standalone local product boundary is defined in
[`product-boundary.md`](product-boundary.md). The core local surfaces—Chat,
Code, projects, artifacts, memory, routines, plugins, skills, MCP,
browser use, Windows computer use, Docker execution, previews, and exports—are
implemented and covered by unit and live Electron probes.

Only platform/distribution work remains:

1. **Linux and macOS computer input.** Browser use and screen capture are
   cross-platform, but real mouse/keyboard injection is currently implemented
   only on Windows. Unsupported input fails clearly.
2. **Wake-from-suspend scheduling.** Routines persist and catch up one missed
   occurrence when Open-Claude starts, but the app does not register an OS
   wake timer while the machine is asleep.
3. **Release infrastructure.** Installers build locally, but production update
   feeds, public signing/notarization, and release publishing require project
   credentials and distribution ownership.

Private cloud transports, official-account import, Office integration, remote
session pools, simulators, device attestation, Buddy, and official feedback or
support upload are deliberate non-goals rather than unfinished local features.

Before calling a change shipped, run `npm run verify`, the relevant live
probes, `npm run dist:win` plus `npm run smoke:packaged`, and
`tools/build-appimage-wsl.sh` plus `tools/smoke-appimage-wsl.sh`.
