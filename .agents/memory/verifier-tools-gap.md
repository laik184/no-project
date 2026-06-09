---
name: Verifier tools gap
description: Root cause and fix for the "Step result marked as failure" verifier bug — missing tool registrations.
---

## The Bug

All verifier verification steps (run_typecheck, run_build, run_tests, check_server_health, validate_runtime, validate_dependencies, analyze_errors, verifier_failure_recovery) were dispatched through the tool registry but **never registered**. The dispatcher returned NOT_FOUND, which the retry-manager stamped as `"Step result marked as failure"`.

## The Fix

Created `server/tools/verifier/` with 9 tools:
- run_typecheck — `npx tsc --noEmit`
- run_build — `npm run build`
- run_tests — `npm run <script>`
- run_lint — `npx eslint`
- check_server_health — fetch() probe on localhost:PORT
- validate_runtime — port binding check + HTTP probe
- validate_dependencies — node_modules + package.json spot-check
- analyze_errors — regex categorizer for TS/build/runtime errors
- verifier_failure_recovery — structured recovery suggestion

Created `server/tools/git/` with 5 tools: git_status, git_diff, git_add, git_commit, git_log.

Both registered in `server/tools/registry/tool-loader.ts`.

**Why:** The verifier tools were planned but never implemented — only the coordinator stubs and step-runner dispatch existed.

**How to apply:** Any new verifier step type must have a corresponding tool in server/tools/verifier/ AND be registered in register-verifier-tools.ts.

## Important: network permission
check_server_health and validate_runtime use fetch() but must NOT declare `permissions: ['network']` — DEFAULT_GRANTED does not include 'network'. Use `permissions: []` or `permissions: ['execute']`.
