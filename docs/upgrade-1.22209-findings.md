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

## Routines (reference 12) — local subset implemented

Local Routines work: the native **local** routine create flow
(`c0243d234` `EpitaxyLocalRoutineCreatePage`, reached from
`/epitaxy/scheduled` → New task → `/epitaxy/scheduled/new-local`) renders
as "Routines / New local routine" with name, description, instructions,
optional folder, and a full schedule picker (Manual / Hourly / Daily /
Weekdays / Weekly / Custom). It creates a routine through the local
scheduler (`createScheduledTask`), which schedules, lists, runs, and
deletes it. `createScheduledTask` used to hard-require a `cwd`; a routine
created without picking a folder now runs in the Cowork files dir
(`~/Claude`). The scheduled surfaces (home `/scheduled-task`, Code
`/epitaxy/scheduled`) list and manage these.

What is **not** reproduced is the **remote** Routines gallery experience:

- The full remote page (`c1c5fa449` `EpitaxyRoutineCreatePage`, marked
  `remote` throughout) has the "What do you want automated?" composer and
  the "Or start from a template" gallery (Briefing / Email triage / System
  health check / PR review digest / …). Its templates bind to cloud
  connectors (Gmail, Slack, GitHub, PagerDuty, Sentry, Linear) and its
  routines are triggered by API or webhook — cloud infrastructure with no
  local equivalent.
- The Code scheduled *list* page renders through `da(...)` in
  `ca82bcec9`, which uses `ta.title` ("Scheduled tasks") unconditionally;
  the `titleRoutines` / `templateGalleryHeading` strings on that
  descriptor are never rendered by a local-reachable component.

So the local automation primitive (create + schedule + run a recurring
task) is fully functional; only the connector-bound template gallery,
which cannot work locally, is absent.
