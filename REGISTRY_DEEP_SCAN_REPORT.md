# Deep Scan Report — `server/tools/registry/`

**Scan Date:** 2025-05-28  
**Total Files:** 9  
**Location:** `server/tools/registry/`

---

## Overview

Yeh directory poore Nura-X system ka **Tool Registry Layer** hai.
Iska kaam hai: har ek AI "tool" (file likhna, terminal chalana, browser khoolna, etc.) ko ek central jagah register karna, unhe securely execute karna, aur sab kuch track karna.

---

## File-by-File Breakdown

---

### 1. `index.ts`
**Role:** Public Barrel Export (Darwaza)

Yeh directory ka **main entry point** hai. Koi bhi bahar se registry use karna chahta hai, woh sirf `index.ts` se import karta hai — directly andar ki files se nahi.

- Sare types, functions, aur classes ko ek jagah se export karta hai
- Backward compatibility maintain karta hai
- Internal file structure bahar se hide karta hai

**Kya export karta hai:** Types, Metadata, Registry, Resolver, Dispatcher, Security, Metrics, DefineTool helper

---

### 2. `tool-types.ts`
**Role:** Core Type Contracts (Nींv / Foundation)

Poori registry layer ka **type system** yahan define hota hai. Koi bhi dusri file yahan se types import karti hai — yeh file kisi bhi dusri file se import nahi karti.

**Kya define karta hai:**

| Type/Interface | Description |
|---|---|
| `ToolCategory` | 5 categories: `filesystem`, `terminal`, `browser`, `verifier`, `coding` |
| `ToolPermission` | 5 permissions: `read`, `write`, `execute`, `network`, `process` |
| `RetryPolicy` | Retry config: maxAttempts, delayMs, backoff strategy |
| `ToolDefinition` | Ek tool ka complete blueprint (naam, category, handler, permissions, timeout, retry) |
| `ToolExecutionContext` | Tool ko milne wala context: runId, projectId, sandboxRoot, AbortSignal |
| `ToolExecutionResult` | Result: ya `{ ok: true, data }` ya `{ ok: false, error, code }` |
| `ToolErrorCode` | Error types: NOT_FOUND, PERMISSION_DENIED, TIMEOUT, VALIDATION_ERROR, EXECUTION_ERROR, UNKNOWN |
| `ToolHandler` | Handler function ka type: `(input, context) => Promise<output>` |

---

### 3. `tool-registry.ts`
**Role:** Singleton Tool Store (Central Register)

**Yeh sabse important file hai.** Ek Map-based singleton store jo sab tools ko apne andar rakhta hai.

**Kya karta hai:**

| Function | Kya karta hai |
|---|---|
| `registerTool(definition, opts)` | Ek naya tool register karta hai. Duplicate check, sealed check, naam/handler validation sab karta hai. Tool ko `Object.freeze()` karke store karta hai. |
| `unregisterTool(name)` | Tool ko hata deta hai (sealed hone ke baad nahi) |
| `getTool(name)` | Naam se ek tool fetch karta hai |
| `listTools()` | Sare registered tool names ki list deta hai |
| `listToolsByCategory(category)` | Category ke hisaab se tools filter karke deta hai |
| `hasTool(name)` | Check karta hai ki tool exist karta hai ya nahi |
| `toolCount()` | Total registered tools count deta hai |
| `sealRegistry()` | **Boot ke baad call hota hai** — iske baad koi naya tool register ya unregister nahi ho sakta (security feature) |
| `isSealed()` | Registry sealed hai ya nahi check karta hai |
| `_resetRegistryForTests()` | Sirf tests ke liye — state reset karta hai |
| `unifiedRegistry` | Backward-compat shim — list, getEntry, getByCategory, getMetrics, getStats expose karta hai |

**Security Feature:** `_sealed` flag — ek baar `sealRegistry()` call hone ke baad koi bhi nayi registration reject ho jaati hai. Yeh **post-boot tool injection attacks** ko rokta hai.

---

### 4. `define-tool.ts`
**Role:** Type-Safe Tool Builder (Helper Utility)

Pehle har tool file mein `as unknown as ToolDefinition` double-cast likhna padta tha (47 files mein!). Yeh helper uss problem ko solve karta hai.

**Kya export karta hai:**

| Function | Kya karta hai |
|---|---|
| `defineTool<TInput, TOutput>(def)` | Strongly-typed tool definition ko registry-compatible `ToolDefinition` mein convert karta hai. Single cast yahan hoti hai, baaki sab jagah type-safe rahta hai. |
| `defineCodingTool<TInput, TOutput>(def)` | `defineTool` ka alias — coding tools ke liye convenience wrapper |

**Fayda:** Code duplication khatam, type safety puri codebase mein.

---

### 5. `tool-resolver.ts`
**Role:** Tool Lookup + Permission Gate (Darban)

Dispatcher ke andar jaane se pehle yeh file check karti hai: "kya yeh tool exist karta hai? Kya caller ke paas permission hai?"

**Kya export karta hai:**

| Export | Kya karta hai |
|---|---|
| `ToolNotFoundError` | Custom error — tool nahi mila |
| `ToolPermissionError` | Custom error — permission nahi hai |
| `resolveTool(name)` | Tool dhundhta hai, na mile toh `ToolNotFoundError` throw karta hai |
| `resolveToolWithPermissions(name, context)` | Tool dhundhta hai + permission check karta hai. Missing permissions pe `ToolPermissionError` throw karta hai. |
| `toolExists(name)` | Non-throwing existence check |
| `validateToolName(name)` | Name validate karta hai, error string return karta hai ya `null` |

**Default Permissions:** Har context ko by default `read`, `write`, `execute` milte hain. Extra permissions `context.meta.grantedPermissions` se milti hain.

---

### 6. `tool-dispatcher.ts`
**Role:** Main Execution Pipeline (Engine)

**Yeh file tool ko actually chalati hai.** Resolver se resolve karne ke baad, dispatcher:
1. Permission check karata hai
2. Timeout enforce karta hai
3. Retry policy lagata hai
4. Metrics record karta hai
5. Audit log likhta hai
6. **Kabhi throw nahi karta** — hamesha `ToolExecutionResult` return karta hai

**Kya export karta hai:**

| Function | Kya karta hai |
|---|---|
| `dispatch(name, input, context, opts)` | **Core function.** Ek tool ko naam se dhundh ke chalata hai. Timeout + retry + metrics + audit sab handle karta hai. |
| `dispatchAll(calls[])` | Multiple tools ko **parallel** mein chalata hai. Ek fail hone se doosre nahi rukते. |
| `dispatchSequential(calls[])` | Multiple tools ko **sequence** mein chalata hai. Pehla fail ho toh ruk jaata hai. |

**Execution Flow:**
```
dispatch() called
    ↓
resolveToolWithPermissions()  ← permission gate
    ↓
withRetry()                   ← retry policy apply
    ↓
withTimeout()                 ← timeout enforce
    ↓
definition.handler()          ← actual tool code chalta hai
    ↓
recordMetric() + recordAudit() ← dono cases mein (success/fail)
    ↓
return ToolExecutionResult     ← kabhi throw nahi karta
```

---

### 7. `tool-metrics.ts`
**Role:** Per-Tool Performance Metrics Store

Har tool ke execution ka performance data yahan store hota hai. In-memory Map mein rakhta hai.

**Kya track karta hai (per tool):**

| Metric | Description |
|---|---|
| `invocations` | Kitni baar tool call hua |
| `failures` | Kitni baar fail hua |
| `retries` | Kitni baar retry hua |
| `timeouts` | Kitni baar timeout hua |
| `avgDurationMs` | Average execution time (ms) |

**Kya export karta hai:**

| Function | Kya karta hai |
|---|---|
| `recordMetric(name, ok, durationMs, retries, timedOut)` | Ek execution ka data store karta hai, running average update karta hai |
| `getMetrics(name)` | Ek specific tool ka metrics deta hai |
| `getAllMetricsSnapshot()` | Sare tools ka ek saath metrics deta hai |
| `resetMetrics(name?)` | Metrics reset karta hai (ek tool ya sab) |

---

### 8. `tool-security.ts`
**Role:** Audit Log (Security Track Record)

Har tool dispatch — success ho ya fail — yahan ek audit entry likhta hai. In-memory circular buffer hai (max 500 entries).

**Audit Entry mein kya hota hai:**

| Field | Description |
|---|---|
| `ts` | Timestamp (ISO string) |
| `toolName` | Kaun sa tool |
| `category` | Kis category ka |
| `runId` | Kaun se run ka |
| `ok` | Success ya failure |
| `durationMs` | Kitna time laga |
| `errorCode` | (sirf failures mein) kaisa error |

**Kya export karta hai:**

| Function | Kya karta hai |
|---|---|
| `recordAudit(entry)` | Ek entry log mein add karta hai |
| `getAuditLog(limit)` | Recent N entries fetch karta hai (default 50) |
| `clearAuditLog()` | Poora log saaf karta hai |
| `auditStats()` | Total, failures, successes ka count deta hai |

---

### 9. `tool-metadata.ts`
**Role:** Tool Discovery Catalogue + Shared Constants

Registered tools ka **pure data catalogue** — koi handler logic nahi, sirf descriptive information. AI agents yahan se available tools discover karte hain. Shared retry policies aur timeout constants bhi yahan hain.

**Shared Constants:**

| Constant | Value | Use Case |
|---|---|---|
| `RETRY_NONE` | 1 attempt, 0ms | Fast, idempotent tools |
| `RETRY_ONCE` | 2 attempts, 500ms linear | Normal tools |
| `RETRY_AGGRESSIVE` | 3 attempts, 1000ms exponential | Critical tools |
| `TIMEOUT.FAST` | 5,000ms | Quick lookups |
| `TIMEOUT.DEFAULT` | 30,000ms | Standard tools |
| `TIMEOUT.LONG` | 120,000ms | Heavy operations |
| `TIMEOUT.BROWSER` | 60,000ms | Browser automation |
| `TIMEOUT.SHELL` | 60,000ms | Terminal commands |
| `TIMEOUT.NPM` | 180,000ms | Package installs |

**Kya export karta hai:**

| Function | Kya karta hai |
|---|---|
| `registerMetadata(meta)` | Tool ka metadata catalogue mein add karta hai (registry.ts automatically call karta hai) |
| `getMetadata(name)` | Ek tool ka metadata fetch karta hai |
| `getAllMetadata()` | Sare tools ka metadata deta hai |
| `getMetadataByCategory(category)` | Category se filter karke metadata deta hai |
| `hasMetadata(name)` | Check karta hai ki metadata exist karta hai |
| `metadataCatalogueSize()` | Total entries count deta hai |

---

## Architecture Summary

```
index.ts              ← Bahar ki duniya yahan se import karti hai
    │
    ├── tool-types.ts         ← Sab types yahan hain (kisi par depend nahi)
    │
    ├── tool-metadata.ts      ← Shared constants + discovery catalogue
    │
    ├── tool-registry.ts      ← Singleton Map store, seal mechanism
    │       └── imports → tool-metadata.ts, tool-metrics.ts
    │
    ├── define-tool.ts        ← Type-safe tool builder helper
    │       └── imports → tool-types.ts
    │
    ├── tool-resolver.ts      ← Naam se dhundho + permission check
    │       └── imports → tool-types.ts, tool-registry.ts
    │
    ├── tool-metrics.ts       ← Per-tool performance tracking
    │
    ├── tool-security.ts      ← Audit log (circular buffer, 500 entries)
    │
    └── tool-dispatcher.ts    ← MAIN ENGINE: resolve→retry→timeout→execute→record
            └── imports → tool-resolver.ts, tool-metrics.ts, tool-security.ts, tool-registry.ts
```

## Data Flow Jab Koi Tool Chalta Hai

```
Agent calls dispatch("fs_write_file", input, context)
    ↓
tool-dispatcher.ts
    ↓ resolveToolWithPermissions()
tool-resolver.ts       → ToolNotFoundError / ToolPermissionError (agar fail)
    ↓ (success)
tool-dispatcher.ts
    ↓ withRetry(withTimeout(handler()))
tool-registry.ts       → frozen ToolDefinition milta hai
    ↓ handler() runs
    ↓
tool-metrics.ts        → recordMetric() — success ya fail dono cases
tool-security.ts       → recordAudit()  — success ya fail dono cases
    ↓
ToolExecutionResult    → { ok: true/false, data/error, durationMs }
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| **Singleton Map** | Ek hi registry, pure app mein — no conflicts |
| **sealRegistry() on boot** | Post-boot tool injection prevent karta hai (security) |
| **Object.freeze() on registration** | Registered tools immutable hain — koi runtime tampering nahi |
| **Dispatcher kabhi throw nahi karta** | Callers ko try-catch nahi likhna padta, typed result milta hai |
| **SRP split** (metrics alag, security alag) | Har file ki ek hi responsibility — easy to test/maintain |
| **Barrel index.ts** | Consumers ko internal structure se alag rakhta hai |
| **defineTool() helper** | 47 files mein double-cast khatam kiya, type safety central |

---

*Report generated by deep scan of `server/tools/registry/` — 9 files, ~580 lines of TypeScript*
