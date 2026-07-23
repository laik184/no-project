---
name: Settings persistence boundary
description: Frontend-only settings behavior and the boundary around account, session, and provider data.
---

The Settings experience must treat profile preferences, provider keys, plan selections, and exported data as browser-local configuration while the imported snapshot has no account or settings backend. It should clearly label local-only behavior and avoid pretending to test remote connections, manage real sessions, or delete a remote account.

**Why:** The imported project is runnable as a frontend but its original server/API sources are absent; fabricating account or provider behavior would make sensitive controls misleading.

**How to apply:** When adding settings capabilities before a backend exists, persist only to local storage, provide honest empty/error states for server-dependent controls, and keep destructive actions scoped to local browser data.