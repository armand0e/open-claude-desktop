# Renderer upgrade 1.21459.1 → 1.22209.0: surface findings

Notes from porting the local reconstruction onto the 1.22209.0 renderer
snapshot and unlocking the surfaces that only exist in the newer bundle.
Chunk names are the staged snapshot under `.package-assets/ion-dist`.

## Product-surface consolidation

The second task facade was removed after the upgrade. Open-Claude now has one
durable session engine exposed through `LocalSessions`; Code and Routines are
the only filesystem-working surfaces. Obsolete task routes redirect to Home or
the matching `/epitaxy/<session-id>` view, obsolete desktop services reject
explicitly, and stale HTTP paths return `410` instead of a compatibility `503`.

## Routines (reference 12) — local subset implemented

Local Routines work: the native **local** routine create flow
(`c0243d234` `EpitaxyLocalRoutineCreatePage`, reached from
`/epitaxy/scheduled` → New task → `/epitaxy/scheduled/new-local`) renders
as "Routines / New local routine" with name, description, instructions,
optional folder, and a full schedule picker (Manual / Hourly / Daily /
Weekdays / Weekly / Custom). It creates a routine through the local
scheduler (`createScheduledTask`), which schedules, lists, runs, and
deletes it. `createScheduledTask` used to hard-require a `cwd`; a routine
created without picking a folder now runs in the Open-Claude-owned Routines
directory. The Code `/epitaxy/scheduled` surface lists and manages these.

What is **not** reproduced is the **remote** Routines gallery experience:

- The full remote page (`c1c5fa449` `EpitaxyRoutineCreatePage`, marked
  `remote` throughout) has the "What do you want automated?" composer and
  the "Or start from a template" gallery (Briefing / Email triage / System
  health check / PR review digest / …). Its templates bind to cloud
  connectors (Gmail, Slack, GitHub, PagerDuty, Sentry, Linear) and its
  routines are triggered by API or webhook — cloud infrastructure with no
  local equivalent.
- The Code scheduled _list_ page renders through `da(...)` in
  `ca82bcec9`, which uses `ta.title` ("Scheduled tasks") unconditionally;
  the `titleRoutines` / `templateGalleryHeading` strings on that
  descriptor are never rendered by a local-reachable component.

So the local automation primitive (create + schedule + run a recurring
task) is fully functional; only the connector-bound template gallery,
which cannot work locally, is absent.
