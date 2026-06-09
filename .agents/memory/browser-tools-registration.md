---
name: Browser tools registration
description: 27 browser tools now registered; were previously entirely absent; Playwright-backed with graceful session management.
---

## Rule
Browser tools (`browser_launch`, `browser_close`, `browser_navigate`, `browser_screenshot`, etc.) MUST be registered via `server/tools/browser/register-browser-tools.ts` which is wired into `server/tools/registry/tool-loader.ts`.

## Why
Prior to this fix, all 27 browser tools were called through the central dispatcher by both the browser agent (`browser/coordination/tool-coordinator.ts`) and the executor agent (`executor/coordination/tool-coordinator.ts`), but zero browser tools existed in the registry. Every browser task returned `NOT_FOUND`.

## How to apply
- Add new browser tools to one of the 4 tool files: `browser-core-tools.ts`, `browser-navigation-tools.ts`, `browser-interaction-tools.ts`, `browser-utility-tools.ts`
- Export the new tool and add it to `ALL_BROWSER_TOOLS` array in `register-browser-tools.ts`
- Session management: use `getSession(runId)` from `browser-session-store.ts`; always call `browser_launch` before any interaction tool
- Permissions: use `permissions: []` or `permissions: ['write']` only — `'network'` is not in DEFAULT_GRANTED and will block dispatch
