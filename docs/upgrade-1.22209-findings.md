# Renderer upgrade 1.21459.1 → 1.22209.0: surface findings

Notes from porting the local reconstruction onto the 1.22209.0 renderer
snapshot and unlocking the surfaces that only exist in the newer bundle.
Chunk names are the staged snapshot under `.package-assets/ion-dist`.

## Home scheduled tasks — `/scheduled-task` (landed)

Native `ScheduledTask{Layout,List,Detail}Route` in `ccd3f68fe`. The list
gate chain is: desktop `yukonSilver` app-feature (`AppFeatures`) →
growthbook `yukon_silver` + `yukon_silver_clocks` → the `dramatic_shrimp`
feature in `/current_user_access`. All four are set locally.
`dramatic_shrimp_force_local` keeps sessions on the local runner and hides
the cloud-backend toggle (`canChooseBackend` stays false because
`yukon_silver_dramatic_shrimp` is left off).

The merged list query calls `GET /cowork/scheduled_tasks`; we return an
empty cloud list so an empty local list can't surface "Failed to load".
The detail route maps `getSessionsForScheduledTask` unconditionally, so it
returns an array (filtered by `scheduledTaskId`) instead of the null
default. Preload `/scheduled` redirect and the injected home Scheduled row
now target `/scheduled-task`.

## Cowork mode (landed)

Task submission runs on the local session runner ("host loop"): the
`claude.web.ClaudeVM` service reports `isHostLoopModeEnabled` so the
composer skips the VM-download/boot wait (there is no Anthropic VM).
`LocalAgentModeSessions` events mirror onto both `LocalSessions` and
`LocalAgentModeSessions` channels so the task view streams. `start()`
accepts the Cowork payload shape (`userSelectedFolders`, `sessionType`);
folderless tasks run in the Cowork files dir (`~/Claude` default). The
`connectedFilesState` store had to move to the 1.22209 object shape
(`{files, selectedFileId, isFeatureEnabled}`) — the Office add-in bridge
reads `state.files` and crashed the whole task view on the old array.

Settings > Cowork (gate `yukon_silver_settings`) is backed by
`claude.web.CoworkUserFiles` (files dir pick/migrate/reveal, persisted in
`coworkFilesRoot`), trusted folders in the `localAgentModeTrustedFolders`
app preference, and global instructions via `claude.web.CoworkMemory`
read/writeGlobalMemory (`coworkGlobalInstructions` in state).

## Code "Routines" variant (reference 12) — deliberately not built

The reference "Routines" page (title "Routines", "What do you want
automated?" composer, "Or start from a template" gallery with Briefing /
Email triage / System health check / etc.) is a **remote, org-backed**
surface, not a local gate flip:

- The local Code scheduled page renders through `da(...)` in `ca82bcec9`,
  which uses `ta.title` ("Scheduled tasks") unconditionally. The
  `titleRoutines` / `subtitleRoutines` / `templateGalleryHeading` strings
  are defined on the same descriptor but are **never** rendered by any
  local-reachable component (a single definition-site occurrence, zero
  `ta.titleRoutines` usages).
- The full Routines page with the automation composer lives in
  `c1c5fa449` (`EpitaxyRoutineCreatePage`), lazy-loaded and marked
  `remote` throughout; the local counterpart is `c0243d234`
  (`EpitaxyLocalRoutineCreatePage`), a plain create form with no gallery.
- The templates bind to cloud connectors (Gmail, Slack, PagerDuty,
  Sentry, Linear) and routines are "kicked off on schedule, by API, or
  webhook" — cloud infrastructure with no local equivalent.

This matches the standing rule that red-X reference annotations mark cloud
items to exclude. The local scheduled surfaces (home `/scheduled-task` and
Code `/epitaxy/scheduled`) both correctly render the "Scheduled tasks"
variant, which is the local-appropriate experience.
