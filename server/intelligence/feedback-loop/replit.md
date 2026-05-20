# Feedback Loop — HVP-Compliant Architecture

## 1. Module Purpose

The `feedback-loop` module transforms the system from a **one-shot executor** into a **self-improving AI engine**.

Without this module: the system generates → returns → done.

With this module: the system generates → evaluates → learns → improves → retries → converges.

This is the core intelligence layer that gives the platform the ability to:
- Detect its own output quality failures
- Generate structured improvement instructions
- Plan the correction strategy
- Decide intelligently whether to retry
- Extract reusable patterns from failure history
- Score its own confidence over time

---

## 2. Flow Diagram

```
FeedbackLoopInput
      │
      ▼
output-evaluator.agent         → EvaluationResult
      │                          (issues[], score, severity, passed)
      ▼
feedback-generator.agent       → Feedback[]
      │                          (instruction, priority, target)
      ▼
improvement-planner.agent      → ImprovementPlan
      │                          (strategy, steps, targetModule, estimatedImpact)
      ▼
retry-decision.agent           → RetryDecision
      │                          (shouldRetry, strategy, reason, delayMs)
      ▼
learning-extractor.agent       → LearningInsight[]
      │                          (pattern, frequency, recommendation, confidence)
      ▼
confidence-scorer.agent        → ConfidenceResult
      │                          (score, grade, factors)
      ▼
orchestrator assembles         → FeedbackLoopOutput (frozen)
      │
      ▼
{ success, score, attempts, improvements, insights, logs }
```

---

## 3. File Responsibilities

### L0 — Contracts

| File | Purpose |
|---|---|
| `types.ts` | All types: Severity, RetryStrategy, LoopStatus, Issue, EvaluationResult, Feedback, ImprovementPlan, RetryDecision, LearningInsight, FeedbackLoopInput, FeedbackLoopOutput |
| `state.ts` | Immutable FeedbackLoopState, factory, transition functions (withAttempt, withStatus), helpers (isExhausted, getScoreTrend) |

### L1 — Orchestrator

| File | Purpose |
|---|---|
| `orchestrator.ts` | Runs all 6 agents in strict sequence. Zero business logic. Manages state transitions. Assembles frozen output |

### L2 — Agents (each has one job, no agent imports another)

| File | Purpose |
|---|---|
| `output-evaluator.agent.ts` | Detects: empty output, incomplete fields, contract violations, logical errors, timeouts → EvaluationResult |
| `feedback-generator.agent.ts` | Maps issues → structured actionable instructions with target and priority → Feedback[] |
| `improvement-planner.agent.ts` | Selects improvement strategy (patch/rerun/escalate), builds step list → ImprovementPlan |
| `retry-decision.agent.ts` | Applies max attempt guard + severity policy → RetryDecision (shouldRetry, strategy, delay) |
| `learning-extractor.agent.ts` | Analyzes full history to find recurring failure patterns → LearningInsight[] |
| `confidence-scorer.agent.ts` | Computes final confidence: baseScore − retryPenalty + insightBonus + trendBonus → grade A–F |

### L3 — Utils (pure functions, no agent imports)

| File | Purpose |
|---|---|
| `scoring.util.ts` | penaltyFromIssues, scoreFromPenalty, retryDecay, confidenceFromHistory, qualityGrade |
| `retry-policy.util.ts` | maxAttemptsGuard, pickRetryStrategy, retryDelayMs, shouldRetryOnSeverity, backoffDelay |
| `issue-normalizer.util.ts` | normalizeSeverity, normalizeCode, sortBySeverity, deduplicateIssues, topSeverity |
| `deep-freeze.util.ts` | Recursive Object.freeze for fully immutable output |

---

## 4. Import Flow

```
L0 (types.ts, state.ts)
  ↑ imported by everyone above

L3 (utils/*.util.ts)
  → imports L0 only
  ↑ imported by L1, L2

L2 (agents/*.agent.ts)
  → imports L0 + L3 only
  → NO agent imports another agent
  ↑ imported by L1 only

L1 (orchestrator.ts)
  → imports L0 + L2 + L3
```

**Forbidden:**
- `agent → agent` imports
- `utils → agent` imports
- Cross-module imports from other domains

---

## 5. Example Execution

### Input
```json
{
  "requestId": "req-42",
  "maxAttempts": 3,
  "currentAttempt": 1,
  "history": [],
  "executionResult": {
    "agentId": "controller-generator",
    "output": { "success": false, "error": "Missing route prefix" },
    "timestamp": 1714000000000,
    "durationMs": 312,
    "metadata": {
      "requiredFields": ["routes", "controller", "middleware"]
    }
  }
}
```

### Output
```json
{
  "success": false,
  "score": 0.6120,
  "attempts": 1,
  "improvements": [
    {
      "strategy": "rerun",
      "targetModule": "core-agent",
      "steps": [
        "Discard current output",
        "Re-initialize agent with corrected input",
        "→ Pre-fix before rerun: A logical error was detected: \"Missing route prefix\"",
        "Re-execute and capture fresh output"
      ],
      "priority": 75,
      "estimatedImpact": 0.52
    }
  ],
  "insights": [
    {
      "pattern": "Recurring logical error in agent output",
      "frequency": 1.0,
      "recommendation": "Add pre-execution input validation and guard clauses",
      "category": "error",
      "confidence": 0.38
    }
  ],
  "logs": [
    "[feedback-loop] START requestId=req-42 maxAttempts=3",
    "[output-evaluator] score=0.55 issues=2 passed=false",
    "[feedback-generator] feedbacks=2 topPriority=75",
    "[improvement-planner] strategy=rerun target=core-agent steps=4",
    "[retry-decision] shouldRetry=true strategy=deep reason=\"Score 0.55 below threshold\"",
    "[learning-extractor] insights=1 trend=stable",
    "[confidence-scorer] score=0.6120 grade=C",
    "[feedback-loop] COMPLETE status=RUNNING score=0.6120 attempts=1"
  ]
}
```

---

## 6. Retry Strategy Explanation

| Strategy | Trigger | Behaviour |
|---|---|---|
| `quick` | Score ≥ 0.5, attempts remaining > 1 | Fast re-evaluation, minimal delay (100ms) |
| `deep` | Score < 0.5 | Full re-execution with correction applied (500ms) |
| `fallback` | Last attempt remaining OR critical severity | Use safe fallback path (1000ms) |

**Max attempts guard:** if `attempts >= maxAttempts`, retry is always blocked regardless of score.

---

## 7. Confidence Scoring Formula

```
finalScore = baseScore − retryPenalty + insightBonus + trendBonus

baseScore      = weighted avg of history scores (40% avg + 60% latest)
retryPenalty   = (attempts−1) / (max−1) × 0.20   [max 0.20 deduction]
insightBonus   = high-confidence insights × 0.02   [max 0.08 bonus]
trendBonus     = (latest − prev) × 0.5            [range −0.10 to +0.10]
```

| Score | Grade |
|---|---|
| ≥ 0.90 | A |
| ≥ 0.75 | B |
| ≥ 0.60 | C |
| ≥ 0.40 | D |
| < 0.40 | F |
