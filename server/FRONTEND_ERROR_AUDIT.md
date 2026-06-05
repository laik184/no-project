# FRONTEND_ERROR_AUDIT.md
**Generated:** 2026-06-05  
**Scope:** client/src/**

---

## 1. Error Display Methods

| Method | Files | Quality |
|---|---|---|
| `alert()` | 6 files, 14 calls | 🔴 Blocking, no style, raw strings |
| `toast()` | 2 files (`useAgentRunner`, `useExternalChangeWarning`) | ✅ Good |
| `console.error` only | 3 files | 🟡 Not visible to user |
| Inline `<div>` error text | 2 files | 🟢 Acceptable |
| None (silent failure) | Many | 🔴 User sees nothing |

---

## 2. Missing Error States

### `submitRun.ts`
- Throws raw `Error` on failure → caller (`useAgentRunner`) has `try/catch` but shows generic message.
- `runId` missing error exposed as-is.

### `useAgentRunner.ts`
- Uses `toast` correctly (destructive variant) — **GOOD**.
- Does not categorise error type; shows raw `err.message`.

### `buildSubscriptions.ts`
- Subscribes to SSE events including `run_failed`.
- Passes raw error string from server event to handler — no friendly formatting.

### `stream-handler.ts`
- On stream error: calls `onError(message)` with raw internal message.

### Conflict components (ConflictBlock, ConflictResolverModal, ConflictResolverPanel)
- **No `useToast` import** — uses `alert()` exclusively.
- No loading states during async operations.
- No retry affordance.

### Diff components (DiffPanel, agent-diff-viewer)
- Uses `alert()` for all feedback (success and error).
- `DiffPanel` renders raw `JSON.stringify(selected)` as "patch preview".

### `CrashPanel.tsx`
- Renders full API response as `JSON.stringify(result, null, 2)`.
- No error state if API call fails.

### `DashboardPanel.tsx`
- Renders all agent events as `JSON.stringify(payload)` — raw internal payloads.
- Uses `alert()` for reload feedback.

---

## 3. Missing React Error Boundary

No `ErrorBoundary` component exists in the codebase.  
If any component throws during render (e.g. malformed SSE payload parsed wrong), the entire app unmounts with a blank white screen and no message.

---

## 4. Missing Features

| Feature | Status |
|---|---|
| React Error Boundary | ❌ Missing |
| Retry button on error states | ❌ Missing |
| Recovery suggestion display | ❌ Missing |
| Error ID shown (for support correlation) | ❌ Missing |
| Consistent toast for success/error | 🟡 Only in 2 files |
| Loading spinners on async operations | 🟡 Partial |
| Network error detection | ❌ Missing |

---

## 5. Good Patterns to Preserve

- `useAgentRunner.ts` — correctly uses `useToast` with `variant: 'destructive'`.
- `CheckpointRollbackDialog.tsx` — has `onError` handler setting `errMsg` state.
- `useCheckpoints.ts` — uses TanStack Query `onError` callback.
- `submitRun.ts` — propagates errors correctly as thrown exceptions (callers handle).
