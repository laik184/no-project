# Global Safety Controller

**Path:** `server/agents/security/global-safety/`  
**Layer:** L1 Orchestrated Pipeline (HVP-compliant)  
**Domain:** `server/agents/security/`  
**Purpose:** System-wide safety enforcement layer. Every action request passes through this module before execution. It detects threats, evaluates numeric risk, enforces 10 system-wide policies, analyzes multi-step chain risk, and makes a final ALLOW/BLOCK decision — with controlled admin override for non-critical cases.

---

## 1. Module Purpose

The Global Safety Controller acts as the last line of defense before any action executes. It answers a single question: **Is this safe to run?**

It does not modify or execute actions — it only inspects and decides. Other modules call it as a pre-execution gate.

**Guarantees:**
- CRITICAL-rated actions are always blocked, even with admin override
- 10 built-in blocking policies cover destructive, exfiltration, escalation, and credential exposure patterns
- Multi-step chains with compounding risk are penalized beyond individual action scores
- Admin override is scoped: HIGH risk can be overridden, CRITICAL cannot

---

## 2. Full Flow Diagram

```
runGlobalSafetyCheck(SafetyInput { action, context?, chain?, isAdmin? })
        │
        ▼
input validation       ─── action required, chain must be string[] if present
        │
        ▼
threat-detector        ─── 18 regex patterns → ThreatReport { detected, threats[], severity, matchedPatterns[] }
        │
        ▼
chain-analyzer         ─── per-step risk scoring + consecutive-step compounding → ChainRisk { compoundScore, flaggedSteps[] }
        │
        ▼
risk-evaluator         ─── base=severityToScore + patternPenalty + chainBonus(40%) → riskScore (0–100) + riskLevel
        │
        ▼
policy-enforcer        ─── 10 system policies (regex) → PolicyResult { allowed, violatedPolicies[], reason }
        │
        ▼
override-controller    ─── isAdmin + riskScore vs thresholds → OverrideResult { overrideGranted, reason }
        │
        ▼
action-guard           ─── final ALLOW/BLOCK logic using all inputs → decision + blockedBy?
        │
        ▼
state.recordDecision   ─── persist decision, riskScore, threats (capped at 500 entries)
        │
        ▼
SafetyResult { success, logs, decision, riskScore, riskLevel, threats, blockedBy? }
```

---

## 3. Agent Responsibilities

| Agent | Single Responsibility | Key Output |
|-------|-----------------------|------------|
| `threat-detector` | Scan action+context against 18 keyword/regex patterns; classify severity | `ThreatReport { detected, threats[], severity, matchedPatterns[] }` |
| `chain-analyzer` | Score each chain step for 8 risky operation types; apply consecutive-step compound bonus | `ChainRisk { hasCompoundingRisk, compoundScore, flaggedSteps[], reason }` |
| `risk-evaluator` | Combine threat severity base + pattern count penalty + chain score (40%) → 0–100 numeric score + level | `riskScore: number`, `riskLevel: RiskLevel` |
| `policy-enforcer` | Match action+context against 10 named blocking policies; collect all violations | `PolicyResult { allowed, violatedPolicies[], appliedPolicies[], reason }` |
| `override-controller` | isAdmin=true + riskScore < 80 → override granted; CRITICAL always denied | `OverrideResult { overrideGranted, reason }` |
| `action-guard` | Combine all prior outputs into single ALLOW/BLOCK decision with structured reason | `decision: SafetyDecision`, `blockedBy?: string` |

---

## 4. Input / Output Examples

### Example A — Blocked (CRITICAL threat)
```typescript
runGlobalSafetyCheck({
  action: "rm -rf /var/data/users",
  context: "Cleanup old user records",
  isAdmin: false,
});
// → { success: true, decision: "BLOCK", riskScore: 98, riskLevel: "CRITICAL",
//     threats: ["recursive deletion"], blockedBy: "Critical risk level..." }
```

### Example B — Blocked (policy violation, no override)
```typescript
runGlobalSafetyCheck({
  action: "DROP TABLE users",
  context: "database migration",
  isAdmin: false,
});
// → { success: true, decision: "BLOCK", riskScore: 90, riskLevel: "CRITICAL",
//     threats: ["drop database"], blockedBy: "Policy violation(s): POL-007..." }
```

### Example C — Admin override granted (HIGH, not CRITICAL)
```typescript
runGlobalSafetyCheck({
  action: "eval(userInput)",
  context: "sandbox testing environment",
  isAdmin: true,
});
// → { success: true, decision: "ALLOW", riskScore: 68, riskLevel: "HIGH",
//     threats: ["shell eval"] }
```

### Example D — Admin override denied (CRITICAL even with admin)
```typescript
runGlobalSafetyCheck({
  action: "sudo su && rm -rf /",
  context: "emergency recovery",
  isAdmin: true,
});
// → { success: true, decision: "BLOCK", riskScore: 100, riskLevel: "CRITICAL",
//     blockedBy: "Override denied — riskLevel=CRITICAL exceeds critical threshold (80)" }
```

### Example E — Clean action, allowed
```typescript
runGlobalSafetyCheck({
  action: "fetch user profile by id",
  context: "dashboard query",
});
// → { success: true, decision: "ALLOW", riskScore: 0, riskLevel: "LOW", threats: [] }
```

---

## 5. Risk Scoring Table

| Input Condition | Score Contribution |
|-----------------|-------------------|
| Severity LOW | Base +10 |
| Severity MEDIUM | Base +35 |
| Severity HIGH | Base +60 |
| Severity CRITICAL | Base +90 |
| Per matched pattern | +8 (capped at +40) |
| Chain length 2–3 steps | +5 |
| Chain length 4–6 steps | +12 |
| Chain length 7+ steps | +20 |
| Consecutive risky chain steps | +50% of step score |
| Chain bonus in risk-evaluator | +40% of chain compound score |
| Final score | Clamped 0–100 |

| Score Range | Risk Level |
|-------------|-----------|
| 0–29 | LOW |
| 30–54 | MEDIUM |
| 55–79 | HIGH |
| 80–100 | CRITICAL |

---

## 6. System Policy Rules

| Policy ID | Name | Pattern Focus | Block |
|-----------|------|---------------|-------|
| POL-001 | Destructive File Operation | rm -rf, unlink, shred | YES |
| POL-002 | System Process Kill | kill -9, shutdown, halt | YES |
| POL-003 | Credential Exposure | password=, api_key:, token= | YES |
| POL-004 | Mass Write Operation | bulk delete, batch write | YES |
| POL-005 | Infinite Loop Pattern | while(true), for(;;) | YES |
| POL-006 | Unsafe Shell Execution | exec(), eval(), system() | YES |
| POL-007 | Database Drop / Truncate | DROP TABLE, DROP DATABASE | YES |
| POL-008 | Network Exfiltration | curl \| bash, nc -e | YES |
| POL-009 | Permission Escalation | sudo su, chmod 777, setuid | YES |
| POL-010 | Sensitive Path Access | /etc/passwd, .ssh/id_rsa | YES |

---

## 7. Override Rules

| Condition | Override Granted |
|-----------|-----------------|
| isAdmin = false | NO — always denied |
| isAdmin = true + riskLevel = CRITICAL | NO — absolute block |
| isAdmin = true + riskLevel = HIGH + score < 80 | YES |
| isAdmin = true + riskLevel ≤ MEDIUM | YES |

Override never bypasses CRITICAL. CRITICAL = permanent block regardless of caller identity.

---

## 8. Call Graph

```
orchestrator.ts
  ├── agents/threat-detector.agent.ts
  │     └── utils/log-builder.util.ts
  ├── agents/chain-analyzer.agent.ts
  │     ├── utils/log-builder.util.ts
  │     └── utils/risk-score.util.ts
  ├── agents/risk-evaluator.agent.ts
  │     ├── utils/log-builder.util.ts
  │     └── utils/risk-score.util.ts
  ├── agents/policy-enforcer.agent.ts
  │     ├── utils/log-builder.util.ts
  │     └── utils/policy-matcher.util.ts
  ├── agents/override-controller.agent.ts
  │     └── utils/log-builder.util.ts
  ├── agents/action-guard.agent.ts
  │     └── utils/log-builder.util.ts
  └── state.ts
```

No agent imports another agent. No circular dependencies.

---

## 9. Performance Notes

- **Synchronous** — zero async/await, zero I/O. All pattern matching is in-memory.
- **Pattern matching** — 18 threat patterns + 10 policy patterns; each is a single `.test()` call. O(p × n) where p = pattern count and n = input length.
- **Chain analysis** — O(s × r) where s = chain steps and r = 8 risky patterns per step.
- **State persistence** — history capped at 500 entries; O(1) append with slice.
- **Deterministic** — same input always produces the same riskScore and decision. No randomness.
- **Regex safety** — all patterns are pre-compiled constants; no runtime regex construction; no catastrophic backtracking patterns.
- **Typical wall-clock** — < 2ms for actions up to 2000 chars with 10-step chains.
