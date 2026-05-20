# Decision Engine — HVP-Compliant Architecture

## 1. Module Purpose

The `decision-engine` is the **reasoning brain** of the Nura-X agent system.

It does NOT execute code. It does NOT call external APIs.

It takes a raw user request and produces a fully reasoned, deterministic, frozen decision:
- **WHAT** the user wants (intent)
- **WHERE** in the system it belongs (domain + context)
- **WHO** should handle it (agents)
- **HOW** to run them (strategy)
- **HOW RISKY** it is (risk level)
- **WHAT SCORE** the decision earns (confidence)
- **WHAT FALLBACK** exists if the primary path fails

---

## 2. Decision Flow Diagram

```
DecisionInput
      │
      ▼
intent-classifier.agent        → ClassifiedIntent
      │                          (intent, confidence, keywords)
      ▼
context-analyzer.agent         → ContextAnalysis
      │                          (domain, complexity, dependencies, steps)
      ▼
capability-mapper.agent        → CapabilityMap
      │                          (primaryAgents, supportingAgents, taskAgentMap)
      ▼
strategy-selector.agent        → StrategySelection
      │                          (strategy, agentSequence, parallelGroups, reasoning)
      ▼
risk-evaluator.agent           → RiskAssessment
      │                          (riskLevel, performanceRisk, securityRisk, failureProb)
      ▼
decision-scorer.agent          → ScoredOption[]
      │                          (ranked by score)
      ▼
fallback-decision.agent        → FallbackDecision
      │                          (triggered?, reason, fallbackAgents)
      ▼
orchestrator assembles         → DecisionOutput (frozen)
      │
      ▼
{ success, decision, logs }
```

---

## 3. File Responsibilities

### L0 — Contracts (no upward imports)

| File | Purpose |
|---|---|
| `types.ts` | All TypeScript types: Intent, Strategy, RiskLevel, Domain, all interfaces |
| `state.ts` | Immutable state shape, factory, pure transition functions |

### L1 — Orchestrator (imports L2 only)

| File | Purpose |
|---|---|
| `orchestrator.ts` | Runs the 7-step pipeline. Zero business logic. Pure coordination + state transitions |

### L2 — Agents (import L3 + L0 only, never each other)

| File | Purpose |
|---|---|
| `agents/intent-classifier.agent.ts` | Keyword-based intent classification → generate / fix / analyze / deploy / optimize |
| `agents/context-analyzer.agent.ts` | Detects domain, complexity, dependencies, estimated steps, security flags |
| `agents/capability-mapper.agent.ts` | Maps (intent × domain) → primary + supporting agents |
| `agents/strategy-selector.agent.ts` | Picks single-agent / multi-agent / pipeline based on complexity + capability |
| `agents/risk-evaluator.agent.ts` | Computes performance, security, failure risks → RiskLevel |
| `agents/decision-scorer.agent.ts` | Scores primary vs fallback options using weighted formula |
| `agents/fallback-decision.agent.ts` | Triggers fallback if score < 0.45 or risk is critical |

### L3 — Utils (import L0 only, never agents)

| File | Purpose |
|---|---|
| `utils/scoring.util.ts` | Weighted score formula, capability score, risk penalty, complexity penalty |
| `utils/normalization.util.ts` | clamp, normalizeToUnit, softmax, percentile |
| `utils/priority.util.ts` | Intent priority table, risk multipliers, complexity factors, rankByPriority |
| `utils/deep-freeze.util.ts` | Recursive Object.freeze for immutable output contracts |

---

## 4. Who Calls Whom

```
orchestrator.ts
  → intent-classifier.agent.ts    → normalization.util.ts
  → context-analyzer.agent.ts     (pure logic only)
  → capability-mapper.agent.ts    (pure logic only)
  → strategy-selector.agent.ts    (pure logic only)
  → risk-evaluator.agent.ts       → normalization.util.ts
  → decision-scorer.agent.ts      → scoring.util.ts, priority.util.ts
  → fallback-decision.agent.ts    (pure logic only)
  → deep-freeze.util.ts
```

**Forbidden:**
- Agent → Agent imports
- Utils → Agent imports
- Cross-module imports from other domains

---

## 5. Import Flow

```
L0 (types.ts, state.ts)
  ↑ imported by L1, L2, L3

L3 (utils/*.util.ts)
  ↑ imported by L1, L2
  → imports L0 only

L2 (agents/*.agent.ts)
  ↑ imported by L1 only
  → imports L0 + L3

L1 (orchestrator.ts)
  → imports L0 + L2 + L3
```

---

## 6. Example Input → Output

### Input
```json
{
  "requestId": "req-001",
  "userInput": "Create a REST API controller for user authentication with JWT",
  "context": {
    "dependencies": ["express", "jsonwebtoken", "bcrypt"],
    "projectType": "node"
  },
  "availableAgents": ["controller-generator", "auth-generator", "code-gen", "error-fixer"],
  "timestamp": 1714000000000
}
```

### Output
```json
{
  "success": true,
  "decision": {
    "intent": "generate",
    "selectedStrategy": "multi-agent",
    "selectedAgents": ["auth-generator", "controller-generator"],
    "confidence": 0.7820,
    "riskLevel": "medium"
  },
  "logs": [
    "[decision-engine] START requestId=req-001",
    "[intent-classifier] intent=generate confidence=0.82",
    "[context-analyzer] domain=backend complexity=medium steps=8",
    "[capability-mapper] primary=[auth-generator, controller-generator] supporting=[code-gen]",
    "[strategy-selector] strategy=multi-agent agents=[auth-generator, controller-generator]",
    "[risk-evaluator] riskLevel=medium failureProb=0.28",
    "[decision-scorer] bestScore=0.74 optionId=primary",
    "[fallback-decision] not triggered — using primary strategy",
    "[decision-engine] COMPLETE confidence=0.782 risk=medium"
  ]
}
```

---

## 7. Strategy Explanation

| Strategy | When Used | Behaviour |
|---|---|---|
| `single-agent` | Low complexity + 1 primary agent | Direct handoff to one agent |
| `multi-agent` | Medium complexity or 2–3 agents | Agents run in parallel groups |
| `pipeline` | High complexity, security implications, or 4+ agents | Strict sequential execution |

**Security override:** If `hasSecurityImplication` is true, security agents (sanitizer, rate-limiter, auth) are always placed first in the pipeline regardless of strategy.

---

## 8. Risk Model Explanation

Risk is computed from 3 independent signals:

```
performanceRisk  = f(complexity, agent count, strategy type)
securityRisk     = f(security implication flag, intent=deploy, domain=security)
failureProbability = f(confidence inverse, complexity, dependency count)

riskLevel = classify(perf×0.3 + sec×0.4 + failure×0.3)
```

| Aggregate | Level |
|---|---|
| ≥ 0.70 | critical |
| ≥ 0.50 | high |
| ≥ 0.30 | medium |
| < 0.30 | low |

**Fallback triggers when:**
- Best score < 0.45, OR
- riskLevel = critical

---

## 9. Scoring Formula

```
score = (0.35 × confidence) + (0.30 × capabilityScore) − (0.25 × riskPenalty) − (0.10 × complexityPenalty)
```

Scores are clamped to [0, 1]. Options are ranked descending. The top-ranked option wins unless fallback triggers.
