# IMPLEMENTATION_PLAN.md
**Generated:** 2026-06-05  
**Status:** ✅ Implemented

---

## Phase 1 — Central Error Infrastructure ✅

**Files created:**
- `server/shared/errors/base-app-error.ts` — `BaseAppError` + `AppErrorFields`
- `server/shared/errors/error-types.ts` — 15 typed subclasses
- `server/shared/errors/error-factory.ts` — `ErrorFactory` with `.wrap()` and typed constructors
- `server/shared/errors/error-serializer.ts` — `serialize()`, `toUserFacingError()`, `toApiErrorBody()`, `logError()`
- `server/shared/errors/global-handlers.ts` — `installGlobalHandlers()`
- `server/shared/errors/express-error-middleware.ts` — 4-arg Express error handler
- `server/shared/errors/index.ts` — public barrel

---

## Phase 2 — Wire into main.ts ✅

- `installGlobalHandlers()` called before anything else
- `expressErrorMiddleware` registered as last middleware
- `.catch(() => {})` silences in `chat-orchestrator.ts` upgraded to `.catch(err => logError(err, ...))`

---

## Phase 3 — Frontend Error Helper ✅

**Files created:**
- `client/src/lib/app-error.ts` — `toastError(toast, err, fallback?)` helper
- `client/src/components/ui/error-boundary.tsx` — React Error Boundary

---

## Phase 4 — Fix Frontend alert() Offenders ✅

| File | Change |
|---|---|
| `ConflictBlock.tsx` | `alert()` → `toast` (destructive) |
| `ConflictResolverModal.tsx` | `alert()` → toast |
| `ConflictResolverPanel.tsx` | `alert()` → toast |
| `DiffPanel.tsx` | `alert()` → toast |
| `agent-diff-viewer.tsx` | `alert()` → toast |
| `DashboardPanel.tsx` | `alert()` → toast |
| `CrashPanel.tsx` | Raw `JSON.stringify` → formatted output |

---

## Phase 5 — Wire chat-orchestrator silent swallows ✅

| Location | Before | After |
|---|---|---|
| `chat-orchestrator.ts:77` | `.catch(() => {})` | `.catch(e => logError(e, 'run-complete'))` |
| `chat-orchestrator.ts:95` | `.catch(() => {})` | `.catch(e => logError(e, 'run-fail'))` |
| `chat-orchestrator.ts:171` | `.catch(() => {})` | `.catch(e => logError(e, 'complete-run'))` |

---

## Verification Checklist

- [x] `server/shared/errors/` directory created with 7 files
- [x] `installGlobalHandlers()` wired in `main.ts`
- [x] `expressErrorMiddleware` wired in `main.ts`
- [x] All `alert()` calls in 6 frontend files replaced with toast
- [x] Silent `.catch(() => {})` upgraded to log-and-continue
- [x] React Error Boundary available for app-level wrapping
- [x] No new architectural violations introduced
- [x] Server boots cleanly after changes

---

## NOT Changed (by design)

- Existing `{ ok: false, error: string }` return shapes — preserved for backward compat
- Individual agent error classes (`PlannerError`, `CoderXContextError`, etc.) — left in place, compatible via `ErrorFactory.wrap()`
- Business logic in any agent or tool — zero behavioural changes
- Test files — not touched
