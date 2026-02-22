# Task Tree + Daemon Quality Plan

## Scope
- Improve `happy` quality in five areas:
  - CLI startup consistency across agents.
  - Daemon known-session reattach with fail-closed PID safety.
  - Cross-platform CLI detection via machine RPC (`detect-cli`).
  - Task Tree V1 in app (`Task -> Machine -> Session`) backed by session metadata.
  - Documentation and rollback guidance.
- Keep server schema unchanged (no new DB table, no migration).

## Implemented Design

### 1) CLI startup consistency + default agent
- Added shared daemon lifecycle utility:
  - `ensureDaemonRunning()` for all agent entry paths.
  - `resolveDefaultAgent()` with backward-compatible default `claude`.
- `happy` without subcommands now routes by `settings.defaultAgent`.
- Supported values: `claude`, `codex`, `gemini`.

### 2) Known-session reattach (daemon restart recovery)
- Added local marker registry at:
  - `${HAPPY_HOME_DIR}/tmp/daemon-sessions/pid-<pid>.json`
- Marker fields:
  - `pid`, `sessionId`, `startedBy`, `metadata`, `processCommandHash`, timestamps, `happyHomeDir`.
- Daemon startup reattach logic:
  - filter by same `happyHomeDir`,
  - require alive PID,
  - require allowed Happy process class,
  - require command hash match when present.
- Stop-session safety:
  - PID kill path now validates process class and optional command hash before SIGTERM.
- Added opt-out switch:
  - `HAPPY_DAEMON_REATTACH_ENABLED=0` disables marker-based reattach at daemon startup.

### 3) Cross-platform CLI detection
- Added machine/session common RPC `detect-cli`:
  - scans `PATH` directly,
  - uses `PATHEXT` on Windows,
  - does not depend on interactive shell profiles.
- App `useCLIDetection` now:
  - tries `machineDetectCLI()` first,
  - falls back to legacy bash-based probing only on RPC failure.

### 4) Task Tree V1 (metadata-backed, feature-flagged)
- Session metadata extended with optional:
  - `task: { id, title, source: "auto" | "manual", updatedAt }`
- CLI auto-task metadata:
  - first user message sets auto task title,
  - title normalization and 72-char cap,
  - never overwrites manual task metadata.
- App task tree data model:
  - grouping order: `Task -> Machine -> Session`,
  - primary key: `metadata.task.id`,
  - fallback grouping key: `(machineId, path)` derived task id.
- Task rename UX:
  - rename from list updates all sessions in that task,
  - persists via `update-metadata` with version-mismatch retry.
- Gating:
  - enabled only when `settings.experiments && settings.taskTreeViewEnabled`.

## Compatibility and Dedup
- No server protocol/schema break.
- Existing sessions without `metadata.task` stay fully compatible.
- Reattach only targets Happy-known sessions (markers), not arbitrary external CLI processes.
- Design references `origin/clawdbot-integration` ideas (reattach/PID safety), but implementation is integrated into current architecture and directory layout.

## Rollback

### Disable Task Tree
- Turn off either flag in app settings:
  - `experiments = false`, or
  - `taskTreeViewEnabled = false`.
- Behavior falls back to the previous flat session list.

### Disable session reattach
- Recommended:
  - start daemon with `HAPPY_DAEMON_REATTACH_ENABLED=0`.
- Optional cleanup:
  - stop daemon,
  - remove marker files under `${HAPPY_HOME_DIR}/tmp/daemon-sessions/`,
  - restart daemon.

## Validation Matrix
- CLI:
  - `happy`, `happy claude`, `happy codex`, `happy gemini`, `happy acp` all ensure daemon startup consistency.
  - `defaultAgent` fallback is `claude`.
- Daemon:
  - marker read/write, invalid marker tolerance, home-dir isolation.
  - hash mismatch rejects reattach/kill by PID (fail-closed).
- App:
  - task tree builder grouping/sorting.
  - task rename persists `source=manual` and survives sync.
  - detect-cli RPC path with fallback resilience.
