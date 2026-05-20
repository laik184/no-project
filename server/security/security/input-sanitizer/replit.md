# Input Sanitizer — HVP-Compliant Architecture

## 1. Sanitization Flow

```
Raw Input Payload (untrusted)
         |
         ▼
orchestrator.sanitizeInput(payload, options)
         |
         ├── Step 1: payload-normalizer
         │     - stripNullBytes()
         │     - stripControlChars()
         │     - trim + whitespace collapse
         │     - truncate to maxStringLength
         │
         ├── Step 2: html-sanitizer
         │     - remove <script>...</script> blocks
         │     - remove on* event attributes
         │     - block javascript: / vbscript: protocols
         │     - strip <iframe>, <object>, <embed>, <applet>
         │
         ├── Step 3: script-sanitizer
         │     - remove eval(), new Function()
         │     - block setTimeout/setInterval with string arg
         │     - remove document.write()
         │     - block innerHTML/outerHTML assignment
         │     - remove dynamic import(), require()
         │     - strip template literals
         │     - block data:text/html URIs
         │
         ├── Step 4: sql-sanitizer
         │     - detect OR 1=1 tautologies
         │     - detect stacked queries (;SELECT...)
         │     - detect SLEEP(), BENCHMARK() blind injection
         │     - detect CHAR() / hex encoding bypasses
         │     - detect SQL comment sequences (--, #, /*)
         │     - escape remaining value with escapeSql()
         │
         ├── Step 5: url-sanitizer
         │     - block javascript:, vbscript:, data: protocols
         │     - enforce allowedProtocols (default: https, http, mailto, ftp)
         │     - truncate URLs to max 2048 chars
         │     - only checks URL-context fields (url, href, src, link, redirect, etc.)
         │
         └── Step 6: validation-agent
               - check remnant script tags after all sanitizers
               - check remnant javascript: protocols
               - check remnant null bytes
               - check field length limits
               - sets status = SUCCESS | FAILED
               │
               ▼
         SanitizationResult { success, sanitized, issues, logs }
```

---

## 2. File Responsibilities

### L0 — Foundation

| File | Responsibility |
|------|----------------|
| `types.ts` | All TypeScript types: `InputPayload`, `SanitizedPayload`, `Issue`, `SanitizationResult`, `ValidationResult`, state shapes. No logic. |
| `state.ts` | Immutable `SanitizerState`, `INITIAL_STATE`, `transitionState()`. |

### L1 — Orchestrator

| File | Responsibility |
|------|----------------|
| `orchestrator.ts` | Sequences all six sanitization steps. No regex or escaping logic. Exposes `sanitizeInput`, `validateInput`, `getSanitizationReport`. |

### L2 — Agents

| File | Responsibility |
|------|----------------|
| `payload-normalizer.agent.ts` | Strips null bytes, control chars, collapses whitespace, enforces length limits. First pass — pure normalization. |
| `html-sanitizer.agent.ts` | Removes all XSS vectors: `<script>`, `on*` attributes, `javascript:`, dangerous tags (iframe, object, embed, etc.). |
| `script-sanitizer.agent.ts` | Removes JS injection patterns: `eval`, `Function()`, `document.write`, `innerHTML`, `import()`, template literals. |
| `sql-sanitizer.agent.ts` | Detects and flags SQL injection patterns, then escapes the remaining value with `escapeSql()`. |
| `url-sanitizer.agent.ts` | Validates URL-context fields against allowedProtocols, blocks unsafe schemes, enforces URL max length. |
| `validation-agent.agent.ts` | Final gate — verifies no dangerous remnants remain after all sanitizers have run. Sets `SUCCESS` or `FAILED`. |

### L3 — Utils

| File | Responsibility |
|------|----------------|
| `regex.util.ts` | Centralized `PATTERNS` object of all compiled regexes. `test()` and `replace()` helpers that reset `lastIndex`. |
| `escape.util.ts` | `escapeHtml()`, `escapeSql()`, `stripNullBytes()`, `stripControlChars()`, `escapeRegex()`. Pure character transforms. |
| `pattern.util.ts` | URL protocol allowlist, `isValidUrl()`, `isSafeProtocol()`, `exceedsMaxLength()`, `truncate()`, length constants. |
| `sanitizer-map.util.ts` | `mapStringFields()` — recursively walks any object and applies a sanitizer to every string value. |
| `logger.util.ts` | Structured log/error strings with ISO timestamp and source label. |

---

## 3. Import Relationships

```
index.ts
  └── orchestrator.ts (L1)
        ├── agents/payload-normalizer.agent.ts (L2)
        │     └── utils/escape.util.ts, logger.util.ts, pattern.util.ts, regex.util.ts, sanitizer-map.util.ts (L3)
        ├── agents/html-sanitizer.agent.ts (L2)
        │     └── utils/logger.util.ts, regex.util.ts, sanitizer-map.util.ts (L3)
        ├── agents/script-sanitizer.agent.ts (L2)
        │     └── utils/logger.util.ts, regex.util.ts, sanitizer-map.util.ts (L3)
        ├── agents/sql-sanitizer.agent.ts (L2)
        │     └── utils/escape.util.ts, logger.util.ts, regex.util.ts, sanitizer-map.util.ts (L3)
        ├── agents/url-sanitizer.agent.ts (L2)
        │     └── utils/logger.util.ts, pattern.util.ts, regex.util.ts, sanitizer-map.util.ts (L3)
        ├── agents/validation-agent.agent.ts (L2)
        │     └── utils/logger.util.ts, pattern.util.ts, regex.util.ts (L3)
        ├── state.ts (L0)
        └── types.ts (L0)
```

**Rules enforced:**
- L1 imports L2, L3, L0 — never upward
- L2 imports L3 and L0 only — zero agent-to-agent imports
- L3 is self-contained — no intra-package imports
- L0 has no imports

---

## 4. Attack Prevention Strategy

### XSS (Cross-Site Scripting)
| Vector | Mitigation |
|--------|-----------|
| `<script>alert(1)</script>` | Entire block removed by `html-sanitizer` |
| `<img onerror="alert(1)">` | `on*` attributes stripped |
| `<a href="javascript:alert(1)">` | `javascript:` protocol blocked in HTML and URL sanitizers |
| `<iframe src="evil.html">` | `<iframe>` and all dangerous tags stripped |
| Template literal injection | Template literals removed by `script-sanitizer` |

### SQL Injection
| Vector | Mitigation |
|--------|-----------|
| `' OR '1'='1` | Tautology pattern detected and flagged |
| `'; DROP TABLE users;--` | Stacked query detected; `--` comment removed |
| `' UNION SELECT * FROM users` | SQL keywords detected; value escaped |
| `SLEEP(5)` | Time-based blind injection detected |
| `CHAR(65)` / `0x41` | Encoding bypass detected |
| All remaining values | `escapeSql()` applied to escape single quotes, backslashes, null bytes |

### Script Injection
| Vector | Mitigation |
|--------|-----------|
| `eval("malicious")` | `eval()` removed |
| `new Function("return fetch...")` | `Function()` constructor removed |
| `setTimeout("code", 0)` | `setTimeout` with string arg removed |
| `document.write("<script>")` | `document.write()` removed |
| `el.innerHTML = "<script>"` | `innerHTML/outerHTML` assignment removed |
| `import("https://evil.com/x.js")` | Dynamic `import()` removed |
| `data:text/html,<script>` | `data:text/html` URI removed |

### Unsafe URLs
| Vector | Mitigation |
|--------|-----------|
| `javascript:void(0)` | Blocked — unsafe protocol |
| `vbscript:msgbox(1)` | Blocked — unsafe protocol |
| `data:text/html,...` | Blocked — unsafe protocol |
| `file:///etc/passwd` | Blocked — not in allowedProtocols |
| URLs > 2048 chars | Truncated with issue logged |

---

## 5. Example Usage

```typescript
import { sanitizeInput, validateInput, getSanitizationReport, INITIAL_STATE } from "./index.js";

// Sanitize a form submission
const result = sanitizeInput(
  {
    name: "  John <script>alert(1)</script>  ",
    email: "user@example.com",
    comment: "Nice site! '; DROP TABLE users; --",
    redirect_url: "javascript:void(0)",
  },
  { maxStringLength: 1000, normalizeWhitespace: true },
  INITIAL_STATE,
);

// result.output.sanitized →
// {
//   name: "John ",
//   email: "user@example.com",
//   comment: "Nice site! \\'; DROP TABLE users; --",
//   redirect_url: ""
// }

// result.output.issues → [
//   { field: "name",         type: "XSS",           level: "BLOCKED", ... },
//   { field: "comment",      type: "SQL_INJECTION",  level: "BLOCKED", ... },
//   { field: "redirect_url", type: "UNSAFE_PROTOCOL",level: "BLOCKED", ... }
// ]

// result.output.success → true (sanitized, no remnants)

// Get a full report from current state
const report = getSanitizationReport(result.nextState);
// report.output.issues → all accumulated issues across the session
```
