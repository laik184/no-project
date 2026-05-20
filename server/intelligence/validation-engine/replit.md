# Validation Engine — server/agents/intelligence/validation-engine/

## Purpose

This is the system quality gate. Every output from generation, execution, and intelligence agents passes through here before being accepted. It detects syntax errors, contract violations, schema mismatches, logical flaws, security vulnerabilities, performance anti-patterns, and structural inconsistencies — returning a deterministic score and structured issue list.

Without this module: the system ships broken or unsafe output.  
With this module: the system is self-correcting.

---

## Flow

```
validate(ValidationInput)
        │
        ├── [1] syntax-validator      → ValidationIssue[]
        ├── [2] contract-validator    → ValidationIssue[]
        ├── [3] schema-validator      → ValidationIssue[]
        ├── [4] logic-validator       → ValidationIssue[]
        ├── [5] security-validator    → ValidationIssue[]
        ├── [6] performance-validator → ValidationIssue[]
        ├── [7] consistency-validator → ValidationIssue[]
        │
        ├── error-normalizer.util    (normalize + deduplicate)
        ├── result-builder.util      (compute score, build frozen result)
        └── state.recordValidation   (update history + metrics)
```

All seven validators run independently. No agent calls another agent.

---

## File Responsibilities

### L0 — Foundation

| File | Responsibility |
|------|----------------|
| `types.ts` | All shared types: `ValidationInput`, `ValidationIssue`, `ValidationResult`, `ValidationState`, `ValidationRecord`, `IssueSeverity`, `IssueType`, `IssueLocation`. |
| `state.ts` | Tracks `totalValidations`, `failureCount`, `lastScore`, rolling `history` (capped at 200). All writes are immutable. Exposes `getSuccessRate()` and `getAverageScore()`. |

### L1 — Orchestrator

| File | Responsibility |
|------|----------------|
| `orchestrator.ts` | Runs all seven validators, merges issues, normalizes + deduplicates, builds the final frozen result, updates state. No validation logic. |

### L2 — Agents (Single Responsibility, No Cross-Imports)

| File | What It Checks | Key Rules |
|------|----------------|-----------|
| `syntax-validator.agent.ts` | Bracket balance, console calls, debugger statements, oversized lines | Empty code = critical issue |
| `contract-validator.agent.ts` | Required output fields (`success`, `logs`), required metadata keys, source tag | Source "unknown" = medium issue |
| `schema-validator.agent.ts` | Optional schema shape validation — presence and type of declared fields | Only runs if `input.schema` provided |
| `logic-validator.agent.ts` | Empty catch, dead code after return, `while(true)`, loose null checks, `eval()`, async-without-await | `eval()` = critical |
| `security-validator.agent.ts` | XSS (`innerHTML`, `document.write`), code injection (`eval`, `new Function`), hardcoded secrets, insecure HTTP, weak random, shell injection, insecure cookies | Multiple critical rules |
| `performance-validator.agent.ts` | Triple-nested loops, chained array iterations, `JSON.parse(JSON.stringify())`, large allocations, uncleared intervals, output size > 100KB | Nested loops = medium/high |
| `consistency-validator.agent.ts` | Mixed naming conventions, mixed quotes, mixed indentation, mixed import styles (ESM vs CJS), multiple default exports | CJS + ESM mix = high |

### L3 — Pure Utilities (No Imports, No State)

| File | Responsibility |
|------|----------------|
| `utils/deep-freeze.util.ts` | Recursively `Object.freeze()` any value. |
| `utils/scoring.util.ts` | `computeScore()` — deducts 25/12/5/2 per critical/high/medium/low issue. `hasCriticalIssues()`, `isPassingScore()`, `summarySeverity()`. |
| `utils/error-normalizer.util.ts` | `normalizeError()` — wraps exceptions into `ValidationIssue`. `normalizeIssues()` — trims/caps messages. `deduplicateIssues()` — removes duplicate type+rule+message combos. |
| `utils/result-builder.util.ts` | `buildResult()` — computes score, checks critical issues, sets `success`, returns frozen `ValidationResult`. `buildErrorResult()` — wraps fatal exceptions. |

---

## Import Rules

```
orchestrator  →  agents       ✔
orchestrator  →  utils        ✔
orchestrator  →  state        ✔
agents        →  utils        ✔
agents        →  types        ✔
utils         →  types        ✔  (scoring, error-normalizer, result-builder)
utils         →  nothing else ✔
agent         →  agent        ✗  (never)
utils         →  state        ✗  (never)
utils         →  agents       ✗  (never)
```

---

## Scoring System

Each issue deducts from a base score of 100:

| Severity | Deduction |
|----------|-----------|
| critical | −25 |
| high     | −12 |
| medium   | −5  |
| low      | −2  |

Score is clamped to [0, 100].  
**Pass threshold: ≥ 60**  
**Automatic failure if any `critical` issue exists, regardless of score.**

---

## Output Contract

```json
{
  "success": true,
  "issues": [
    {
      "type": "security",
      "severity": "critical",
      "message": "innerHTML assignment detected — XSS vector. Use textContent or sanitize input. (1 occurrence)",
      "rule": "xss-innerHTML"
    }
  ],
  "score": 75,
  "logs": [
    "[validation] Starting validation — source=\"generation\", size=420B",
    "[validation] Syntax:      0 issue(s)",
    "[validation] Security:    1 issue(s)",
    "..."
  ]
}
```

---

## Example Input → Output

### Input — insecure generated code

```json
{
  "source": "generation",
  "code": "element.innerHTML = userInput; const token = 'hardcoded-secret-123';",
  "agentId": "backend-gen"
}
```

### Output

```json
{
  "success": false,
  "issues": [
    { "type": "security", "severity": "critical", "message": "innerHTML assignment detected — XSS vector.", "rule": "xss-innerHTML" },
    { "type": "security", "severity": "high",     "message": "Potential hardcoded credential detected.", "rule": "hardcoded-credential-pattern" }
  ],
  "score": 63,
  "logs": ["[validation] Score: 63 — FAILED"]
}
```

> success = false because a critical issue is present, regardless of score.

---

## State Tracked

| Field | Description |
|-------|-------------|
| `totalValidations` | Cumulative count of all validations run |
| `failureCount` | Count of non-passing validations |
| `lastScore` | Score of the most recent validation |
| `history` | Rolling window of last 200 `ValidationRecord` entries |

Derived helpers: `getSuccessRate()`, `getAverageScore()`.
