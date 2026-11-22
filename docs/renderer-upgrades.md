# Renderer snapshot upgrades

Open-Claude treats the renderer, generated preload/IPC contract, and local
patch set as one release unit. A renderer can be tried without replacing the
known-good snapshot, but it cannot be packaged until every release gate passes.

## Inspect a newer snapshot

Keep extracted snapshots under `reference/claude-<version>/` with `ion-dist/`
and `app.asar.extracted/` beneath it. `reference:extract` can copy the newest
installed renderer into that layout. Use a snapshot-specific metadata output
while exploring so the active generated-contract reference is not changed:

```powershell
$env:CLAUDE_DESKTOP_VERSION = "1.24012.9"
$env:CLAUDE_COPY_ION_DIST = "1"
$env:CLAUDE_REFERENCE_METADATA_OUTPUT = "analysis/reference-snapshots/claude-1.24012.9.json"
npm run reference:extract
npm run renderer:migrate -- 1.24012.9
```

With no version argument, `renderer:migrate` selects the newest retained
snapshot. It does not alter `.package-assets`, `package.json`, or the active
compatibility manifest. It applies compatible rules in memory and writes a
machine-readable report under `analysis/renderer-migrations/` containing every
applied, missing, ambiguous, and unavailable-asset result.
`npm run renderer:migrate:deep -- 1.24012.9` searches lazy chunks too, which is
useful when a stable feature moved files.

Patches have stable intent IDs. When minification changes an anchor, add a
labeled entry to that patch's `variants` array; keep the retained anchor in
place. Unchanged rules carry forward automatically, and each snapshot selects
exactly one compatible variant. Multiple matching variants are an ambiguity
and fail closed.

## Run a candidate without promoting it

```powershell
npm run renderer:candidate:partial -- 1.24012.9
```

Candidate mode points development Electron at the chosen snapshot and applies
all compatible rules on the fly. `--allow-partial` is explicit because missing
rules can leave surfaces unavailable. It rebuilds the Electron main process
before launch so a newly added variant is immediately the code under test. The
patch totals are also written to the normal diagnostics log. This mode is
disabled in packaged builds; installers always use strict mode.

## Verify and promote

After the remaining variants are adapted, regenerate the contract from the
same version and re-run the migration:

```powershell
$env:CLAUDE_DESKTOP_VERSION = "1.24012.9"
$env:CLAUDE_COPY_ION_DIST = "1"
npm run reference:recover
npm run renderer:migrate -- 1.24012.9
npm run renderer:promote -- 1.24012.9
```

Promotion requires all patch rules, the retained contract tree, generated
contract metadata for the target version, and the canonical retained reference
root. It then updates both renderer/contract pins, stages the candidate, and
runs the existing strict renderer verification. If staging or verification
fails, the pins and manifest are restored and the previous snapshot is staged
again.

The current `1.22209.0` to `1.24012.9` report is intentionally not promoted:
32 of 124 rules carry forward (31 unchanged plus one moved-chunk variant), and
92 still need a `1.24xxx` variant or a
decision that the upstream surface now satisfies the intent.
