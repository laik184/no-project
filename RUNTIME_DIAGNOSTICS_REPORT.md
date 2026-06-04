# RUNTIME DIAGNOSTICS REPORT

**Generated:** 2026-06-04  
**Trigger:** Workflow restart detected EADDRINUSE + Vite port fallback  
**Status:** TWO ACTIVE BLOCKERS — server does not start cleanly

---

## ISSUE 1 — EADDRINUSE: Port 3001 Already In Use

### Symptom

```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3001
    at Server.setupListenHandle [as _listen2] (node:net:1908:16)
```

API process crashes immediately after `seedDefaultProject()` completes — the last step before `server.listen()`.

### Root Cause

Two concurrent workflow instances are running simultaneously. The first instance (started 16:58, PID group 1833–1892) still holds port 3001. When Replit triggers a second start (PID group 3412–3465 at 17:07), the older `main.ts` process (PID 1892) has not been terminated before the new one tries to bind.

### Evidence

```
PID 1892  node ... main.ts   (started 16:58 — still running, holds :3001)
PID 3443  tsx watch main.ts  (started 17:07 — crashes, cannot bind :3001)
```

Port state from `/proc/net/tcp`:
```
:3001  — LISTEN  (held by old instance)
:3001  — LISTEN  (second attempt — fails)
:3001  — TIME_WAIT
```

### Effect

- API server **does not start** on the new instance
- All `/api/*` routes are unreachable on the new instance
- All agent dispatches fail immediately with network error (no server to receive)
- `chatOrchestrator`, `initOrchestration`, file watchers all initialized but serve nothing

---

## ISSUE 2 — Vite Bumped to Port 5001 Instead of 5000

### Symptom

```
Port 5000 is in use, trying another one...
  VITE v5.4.21  ready in 165 ms
  ➜  Local:   http://localhost:5001/
```

### Root Cause

Same dual-process issue. The old Vite instance (PID 1864) holds port 5000. The new Vite (PID 3444) cannot bind to 5000 and auto-increments to 5001.

### Evidence

```
PID 1864  vite  (started 16:58 — holds :5000)
PID 3444  vite  (started 17:07 — fallback to :5001)
```

Port state from `/proc/net/tcp`:
```
:5000  — LISTEN  (old instance, still running)
:5001  — LISTEN  (new instance, fallback)
```

### Effect

- Replit workflow is configured `waitForPort: 5000` — this port is served by the **old** Vite (stale build)
- The **new** Vite on :5001 is never registered as the webview target
- Browser sees the old version of the frontend — code changes do NOT appear in preview
- API proxy rules in `vite.config.ts` (`/api → localhost:3001`) point to the old API, not the new one

---

## ISSUE 3 — Cascading State: API Is Running But Wrong

### What Is Actually Serving Requests

| Port | Process | Age | State |
|---|---|---|---|
| `:3001` | PID 1892 `main.ts` | Started 16:58 | Running (old) |
| `:5000` | PID 1864 `vite` | Started 16:58 | Running (old) |
| `:5001` | PID 3444 `vite` | Started 17:07 | Running (new, invisible to webview) |

The API on port 3001 is alive but it is the **old instance** from 16:58 — any code changes made after that time are not reflected. The new instance crashed before it could serve anything.

---

## ISSUE 4 — `tsx watch` Does Not Kill Previous Process on Restart

### Observation

`tsx watch` (the `dev:api` command) is supposed to restart `main.ts` on file changes. However, when Replit triggers a full workflow restart, `concurrently` sends a signal to its child group. If the old `concurrently` group (PID 1833) was not fully terminated before the new one (PID 3412) started, the node process holding the port survives.

### Evidence

```
PID 1833  concurrently ...  (16:58 — still in process table)
PID 3412  concurrently ...  (17:07 — new instance)
```

Both `concurrently` parent processes are alive simultaneously — meaning neither sent SIGKILL to its children before the new group launched.

---

## IMPACT SUMMARY

| Component | Expected | Actual |
|---|---|---|
| API server (`:3001`) | New instance serving latest code | Old instance from 16:58 |
| Vite dev server (`:5000`) | New instance with proxy to new API | Old instance from 16:58 |
| Preview pane | Shows latest UI changes | Shows stale UI |
| `/api/*` requests from browser | Reach latest code | Reach stale code |
| New workflow start | Clean boot | Crashes with EADDRINUSE |

---

## RECOMMENDED FIX ACTIONS (identification only)

| # | Action | Where |
|---|---|---|
| 1 | Kill all `main.ts` / `vite` / `tsx` processes before restarting workflow | Workflow pre-start hook or `dev:api` script |
| 2 | Add `fuser -k 3001/tcp \|\| true` before `tsx watch main.ts` in `dev:api` | `package.json` — `dev:api` script (requires user approval to edit) |
| 3 | Add graceful port check in `main.ts` before `server.listen()` — detect `EADDRINUSE` and exit cleanly | `main.ts` error handler |
| 4 | Workflow restart timeout — ensure old process group fully dead before new one spawns | Replit workflow configuration |

---

## BROWSER CONSOLE CORRELATION

```
1780592388678  [vite] server connection lost. Polling for restart...
1780592940109  [vite] server connection lost. Polling for restart...
1780592390084  [vite] connecting...    ← reconnected to OLD :5000
1780592390300  [vite] connected.
...
1780593108448  [vite] connecting...    ← still reconnecting to OLD :5000
1780593108448  [vite] connected.
```

Browser is continuously reconnecting to the **old** Vite on :5000. It has never connected to the new instance on :5001. All HMR updates from new code changes are invisible.

---

## CONFIDENCE

| Finding | Confidence |
|---|---|
| Dual-process port collision is root cause | HIGH — confirmed by PID timestamps and port table |
| Old instance (16:58) is still active and serving | HIGH — PIDs 1864 + 1892 present in process table |
| New instance (17:07) API is dead | HIGH — EADDRINUSE logged, no new `[server] API server listening` line |
| Browser receiving stale responses | HIGH — browser console confirms reconnection to old :5000 only |
