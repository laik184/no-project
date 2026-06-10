---
name: Process group kill pattern
description: How to reliably kill npm-run child processes (node) on restart without EADDRINUSE or spurious crash events.
---

## The Rule

When spawning with `shell:true`, always also set `detached:true`. Stop by calling `process.kill(-entry.pid, 'SIGTERM')` (negative PID = kill entire process group). Before killing the previous process, set `prevEntry.status = 'stopping'` so the exit handler treats the kill as intentional and does NOT emit `process.crashed`.

## Why

`shell:true` without `detached:true` means the spawned shell and `node server.js` are in the same process group as the NuraX Express server. `SIGTERM` to `entry.child` only kills the shell wrapper — `node server.js` becomes an orphan still holding the port. Next start gets EADDRINUSE. `fuser -k PORT/tcp` is unreliable as a workaround (race conditions, environment availability).

`detached:true` creates a NEW process group with PGID = shell PID. `process.kill(-pgid, 'SIGTERM')` sends SIGTERM to every process in that group, killing both shell and node children atomically.

## How to Apply

In `runtime-manager.ts`:
1. `spawn(cmd, [], { shell: true, detached: true, ... })` — do NOT call `child.unref()` (we still monitor it).
2. `stop()`: `entry.status = 'stopping'` → `process.kill(-entry.pid, 'SIGTERM')` + `setTimeout(() => process.kill(-entry.pid, 'SIGKILL'), 1500)`.
3. `start()` before spawning: `prevEntry.status = 'stopping'` then `process.kill(-prevEntry.pid, 'SIGKILL')` + 600ms wait.
4. Exit handler: `intentional = signal==='SIGTERM' || signal==='SIGKILL' || entry.status==='stopping'` → only emit `process.crashed` when not intentional.

## Pitfall

The OLD entry's exit handler fires DURING the new start() if you kill the old process before replacing the entry. Guard against this by setting `prevEntry.status = 'stopping'` BEFORE killing — this makes the exit handler's `intentional` check true, preventing the spurious crash event that transitions the lifecycle to 'crashed'.
