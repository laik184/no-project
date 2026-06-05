# USER_ERROR_EXPOSURE_REPORT.md
**Generated:** 2026-06-05

---

## Summary

Users currently see raw internal error content in the following forms:

| Exposure Type | Count | Severity |
|---|---|---|
| `alert()` calls with raw error strings | 14 | 🔴 Critical |
| Raw `JSON.stringify(...)` rendered in UI | 6 | 🔴 Critical |
| Internal stack traces potentially exposed | 165 | 🟡 Medium |
| Raw POSIX paths in error messages | ~20 | 🟡 Medium |
| Generic "fail" text with no guidance | 5 | 🟢 Low |

---

## 1. `alert()` with raw error strings

These pop blocking browser dialogs with internal error text:

| File | Pattern |
|---|---|
| `client/src/components/conflict/ConflictBlock.tsx:10` | `alert('AI failed')` |
| `client/src/components/conflict/ConflictBlock.tsx:11` | `alert('Error: '+String(e))` |
| `client/src/components/conflict/ConflictBlock.tsx:32` | `alert('Apply failed: '+(rr.error\|\|'unknown'))` |
| `client/src/components/conflict/ConflictResolverModal.tsx:28` | `alert('Resolved and written')` |
| `client/src/components/conflict/ConflictResolverModal.tsx:29` | `alert('Resolve failed')` |
| `client/src/components/conflict/ConflictResolverPanel.tsx:13` | `alert('Prepare failed')` |
| `client/src/components/conflict/ConflictResolverPanel.tsx:14` | `alert('Error: '+String(e))` |
| `client/src/components/conflict/ConflictResolverPanel.tsx:34` | `alert('Apply failed')` / `alert(String(e))` |
| `client/src/components/diff/DiffPanel.tsx:30` | `alert('Apply failed: ' + (j.error \|\| 'unknown'))` |
| `client/src/components/diff/DiffPanel.tsx:31` | `alert('Apply error: ' + String(e))` |
| `client/src/components/diff/DiffPanel.tsx:42` | `alert('Reject failed: ' + ...)` |
| `client/src/components/diff/agent-diff-viewer.tsx:73,86,90` | `alert('Apply failed: ' + text)` etc. |
| `client/src/components/layout/DashboardPanel.tsx:45,46` | `alert('Loaded N events')` / `alert('fail')` |

**Impact:** Blocking modal dialogs interrupt workflow; raw error strings from network responses reach the user.

---

## 2. Raw `JSON.stringify` rendered to users

| File | Content |
|---|---|
| `client/src/Dashboard.tsx:85` | `JSON.stringify(e, null, 2)` in a `<pre>` — raw event payload |
| `client/src/components/agent/BatchPanel.tsx:97` | `JSON.stringify(status,null,2)` — raw status object |
| `client/src/components/agent/LogsList.tsx` | `JSON.stringify(e.payload,null,2)` — every log event payload |
| `client/src/components/layout/CrashPanel.tsx:23` | `JSON.stringify(result, null, 2)` — raw crash analysis response |
| `client/src/components/layout/DashboardPanel.tsx:32` | `JSON.stringify(ev.payload, null, 2)` — raw agent events |
| `client/src/components/diff/DiffPanel.tsx:55` | `JSON.stringify(selected, null, 2)` — raw patch object |

---

## 3. Current vs Required messages

### LLM not configured
| State | Message |
|---|---|
| **Current** | `LLM call failed: No LLM API key found. Set OPENROUTER_API_KEY…` |
| **Required** | **AI Provider Not Configured** — The system cannot reach an AI model. Add `OPENROUTER_API_KEY` to your environment. |

### Tool not found
| State | Message |
|---|---|
| **Current** | `Tool not found: fs_write_file_typo` |
| **Required** | **Required Tool Unavailable** — A required capability is not available. Try again later. |

### Filesystem permission denied
| State | Message |
|---|---|
| **Current** | `EPERM: operation not permitted, open '/etc/passwd'` |
| **Required** | **File Permission Denied** — The agent cannot write to that location. Check sandbox permissions. |

### Timeout
| State | Message |
|---|---|
| **Current** | `Tool timeout after 30000ms` |
| **Required** | **Operation Timed Out** — The operation did not complete in time. The agent will retry automatically. |

### Generic agent failure
| State | Message |
|---|---|
| **Current** | `[executor]: LLM call failed` |
| **Required** | **Agent Error** — The executor encountered an issue. Checking for recovery options… |
