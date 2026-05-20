# Intelligence-Layer — Cognitive Goal Refinement Engine

## Purpose

The Intelligence-Layer transforms raw, unstructured user input into a structured, enriched
`ImmutableRefinedGoal` ready for downstream planning systems (e.g., Core-Planning, PlannerBoss).

It is the cognitive front-end of the planning pipeline — responsible solely for
understanding and structuring what the user wants, not how to execute it.

---

## What It Does

- **Prompt Refinement**: Normalizes raw text — trims noise, splits sentences, extracts meaningful keywords, scores language clarity
- **Intent Extraction**: Identifies primary and secondary intent types (CREATE/MODIFY/DELETE/DEPLOY...), extracts action-verb phrases, detects domain and scope
- **Ambiguity Resolution**: Detects vague terms, overloaded vocabulary, and missing-context patterns; produces resolution hints
- **Capability Mapping**: Maps detected intent + keywords to system capability domains (backend-code-generation, testing, deployment, etc.)
- **Strategy Hinting**: Produces deterministic execution hints (prefer-sequential, dry-run-first, checkpoint-recommended, etc.) and estimated complexity
- **Confidence Scoring**: Computes weighted `overallConfidence` across all 5 dimensions
- **Readiness Gating**: Sets `readyForPlanning = false` if confidence is too low or ambiguity is too high

---

## What It Does NOT Do

- Execute any task or plan
- Create, rename, move, or delete files
- Call runtime, git, or external APIs
- Validate risk or stability of a plan
- Resolve task dependencies
- Modify any external system state

---

## ASCII Call Hierarchy

```
Consumer
    ↓
index.ts                             (re-export surface — no logic)
    ↓
intelligence-orchestrator.ts         (5-phase coordinator — sole importer of agents)
    ├── [Phase 1] prompt-refinement.agent.ts   → RefinedPrompt
    │     └── utils/text-normalizer.ts         → normalize, split, tokenize, deduplicate
    ├── [Phase 2] intent-extractor.agent.ts    → ExtractedIntent
    │     └── utils/semantic-parser.ts         → detectIntentType, extractActionPhrases, detectDomain
    │     └── utils/confidence-calculator.ts   → normalizeScore
    ├── [Phase 3] ambiguity-resolver.agent.ts  → AmbiguityReport
    │     └── utils/confidence-calculator.ts   → normalizeScore
    ├── [Phase 4] capability-mapper.agent.ts   → CapabilityMap
    │     └── utils/confidence-calculator.ts   → computeCapabilityCoverage
    ├── [Phase 5] strategy-hint.agent.ts       → StrategyHint
    │     └── utils/confidence-calculator.ts   → normalizeScore
    └── Final: computeOverallConfidence → assemble ImmutableRefinedGoal
```

---

## HVP Layer Diagram

```
Level 0   types.ts                              (leaf — no imports)
Level 0   state.ts                              (imports types only — no agents)

Level 3   utils/text-normalizer.ts              (no imports)
Level 3   utils/semantic-parser.ts              (imports types only)
Level 3   utils/confidence-calculator.ts        (no imports)

Level 2   agents/prompt-refinement.agent.ts     (imports types + utils/text-normalizer)
Level 2   agents/intent-extractor.agent.ts      (imports types + utils/semantic-parser + utils/confidence-calculator)
Level 2   agents/ambiguity-resolver.agent.ts    (imports types + utils/confidence-calculator)
Level 2   agents/capability-mapper.agent.ts     (imports types + utils/confidence-calculator)
Level 2   agents/strategy-hint.agent.ts         (imports types + utils/confidence-calculator)

Level 1   intelligence-orchestrator.ts          (imports agents + state + utils/confidence-calculator)
Level 1   index.ts                              (re-export surface only)
```

---

## File Responsibility Breakdown

| File | Lines | Sole Responsibility |
|------|-------|-------------------|
| `types.ts` | ~115 | All shared TypeScript interfaces and union types |
| `state.ts` | ~75 | IntelligenceSession — phase tracking + intermediate storage |
| `utils/text-normalizer.ts` | ~75 | Text cleaning: normalize, split sentences, tokenize, deduplicate |
| `utils/semantic-parser.ts` | ~100 | Pattern matching: verbs, action phrases, domain, scope |
| `utils/confidence-calculator.ts` | ~55 | Weighted confidence score computation |
| `agents/prompt-refinement.agent.ts` | ~50 | Normalize + keyword extraction → RefinedPrompt |
| `agents/intent-extractor.agent.ts` | ~55 | Detect intent types + action phrases → ExtractedIntent |
| `agents/ambiguity-resolver.agent.ts` | ~110 | Vague/overloaded/missing-context detection → AmbiguityReport |
| `agents/capability-mapper.agent.ts` | ~100 | Map keywords → CapabilityDomain[] → CapabilityMap |
| `agents/strategy-hint.agent.ts` | ~110 | Select execution hints + build rationale → StrategyHint |
| `intelligence-orchestrator.ts` | ~90 | 5-phase pipeline coordinator + confidence assembly |
| `index.ts` | ~25 | Public API surface — re-exports only |

---

## Import Direction Rules

```
Allowed:
  index.ts                         → intelligence-orchestrator.ts
  intelligence-orchestrator.ts     → agents/*.agent.ts
  intelligence-orchestrator.ts     → state.ts
  intelligence-orchestrator.ts     → utils/confidence-calculator.ts
  agents/*.agent.ts                → utils/*.ts
  agents/*.agent.ts                → types.ts
  utils/*.ts                       → types.ts (semantic-parser only)
  state.ts                         → types.ts

Forbidden:
  agents → agents          (no cross-agent imports)
  utils  → agents          (utils are downstream)
  state  → agents          (state is pure data)
  state  → utils           (state imports types only)
  any    → Core-Planning   (no external planner dependency)
  any    → stability-risk  (no external planner dependency)
  any    → outside this module
  circular deps            → never
```

---

## Refinement Phases

```
idle → prompt-refinement → intent-extraction → ambiguity-resolution
     → capability-mapping → strategy-hinting → complete
     (or → failed at any phase)
```

---

## IntelligenceResult Contract

```typescript
interface IntelligenceResult<T = undefined> {
  readonly ok:     boolean;           // true = refinement succeeded
  readonly error?: string;            // human-readable reason on failure
  readonly code?:  string;            // ERR_* machine code
  readonly data?:  T;                 // ImmutableRefinedGoal on success
  readonly phase?: RefinementPhase;   // active phase at time of return
}
```

---

## Error Codes

| Code | Phase | Meaning |
|------|-------|---------|
| `ERR_EMPTY_TEXT` | idle | rawInput.text is empty or blank |
| `ERR_EMPTY_PROMPT` | prompt-refinement | normalization produced zero words |
| `ERR_NO_CAPABILITIES` | capability-mapping | no capability domains were matched |

---

## Confidence Score Breakdown

```
overallConfidence = weighted average of:
  promptClarity   × 0.25   (languageConfidence from text-normalizer)
  intentCertainty × 0.30   (confidence from intent-extractor)
  ambiguityFactor × 0.20   (1 - overallAmbiguity from ambiguity-resolver)
  capabilityCover × 0.15   (coverageScore from capability-mapper)
  strategyFit     × 0.10   (hints.length > 0 ? 0.9 : 0.5)

readyForPlanning = overallConfidence >= 0.45 && !isHighlyAmbiguous
```

---

## Example ImmutableRefinedGoal Output

```typescript
{
  goalId:    "ig-1700000000000-0001",
  sessionId: "il-session-1700000000000",
  refinedAt: 1700000000000,

  rawInput: { text: "Create a REST API with Express for a User entity with CRUD operations and unit tests" },

  refinedPrompt: {
    original:          "Create a REST API...",
    normalized:        "create a rest api with express for a user entity with crud operations and unit tests",
    sentences:         ["Create a rest api with express for a user entity with crud operations and unit tests"],
    wordCount:         16,
    cleanedKeywords:   ["rest", "api", "express", "user", "entity", "crud", "operations", "unit", "tests"],
    languageConfidence: 0.82
  },

  intent: {
    primaryIntent:    "CREATE",
    secondaryIntents: ["TEST"],
    actionPhrases:    [{ verb: "create", object: "a rest api", qualifier: "with express" }],
    domain:           "backend",
    scope:            "single-entity",
    confidence:       0.78
  },

  ambiguityReport: {
    signals:          [],
    overallAmbiguity: 0,
    resolvedText:     "create a rest api with express for a user entity...",
    isHighlyAmbiguous: false
  },

  capabilityMap: {
    capabilities: [
      { domain: "backend-code-generation", required: true,  confidence: 0.9, triggerTerms: ["api", "express"] },
      { domain: "api-design",              required: true,  confidence: 0.8, triggerTerms: ["api", "rest"] },
      { domain: "testing",                 required: true,  confidence: 0.7, triggerTerms: ["tests"] },
      { domain: "configuration",           required: true,  confidence: 0.5, triggerTerms: [] },
    ],
    primaryDomain: "backend-code-generation",
    coverageScore: 1.0
  },

  strategyHint: {
    hints:               ["prefer-sequential", "validate-early"],
    estimatedComplexity: 0.5,
    preferredOrder:      ["configuration", "backend-code-generation", "api-design", "testing"],
    warnings:            [],
    rationale:           "Domain \"backend\" with medium complexity. Suggested strategy: prefer-sequential, validate-early."
  },

  overallConfidence: 0.76,
  readyForPlanning:  true
}
```

---

## Refinement Lifecycle

```
1. Receive RawInput { text, context?, sessionId? }

2. Phase 1 — refinePrompt():
      normalize(text) → remove noise, collapse whitespace
      splitSentences() → sentence array
      tokenize() + removeStopWords() → cleanedKeywords
      computeLanguageConfidence() → 0–1 score
      → RefinedPrompt

3. Phase 2 — extractIntent():
      detectIntentType() → primary IntentType from action verbs
      detectAllIntents() → all matched IntentTypes
      extractActionPhrases() → verb + object + qualifier triples
      detectDomain() → "backend" | "frontend" | "database" | ...
      detectScope() → "single-entity" | "full-application" | ...
      → ExtractedIntent

4. Phase 3 — resolveAmbiguity():
      detectVagueTerms() → match "something", "stuff", "etc" patterns
      detectOverloadedTerms() → match "model", "service", "hook" etc.
      detectMissingContext() → match "it", "this", "the thing" patterns
      computeAmbiguityScore() → 0–1 weighted average
      buildResolvedText() → original + inline clarification hints
      → AmbiguityReport

5. Phase 4 — mapCapabilities():
      For each CapabilityDomain, score against cleanedKeywords
      Filter by MIN_CONFIDENCE = 0.35
      Determine primaryDomain by priority order
      Compute coverageScore (required domains covered)
      → CapabilityMap

6. Phase 5 — buildStrategyHint():
      selectHints() → ExecutionHint[] based on intent type + domains
      estimateComplexity() → 0.2–0.9 based on capability count + ambiguity
      buildPreferredOrder() → domains sorted by execution dependency
      buildWarnings() → destructive intent, low confidence, high ambiguity
      buildRationale() → human-readable summary string
      → StrategyHint

7. Final Assembly:
      computeOverallConfidence() → weighted 5-factor score
      readyForPlanning = confidence ≥ 0.45 && !isHighlyAmbiguous
      Object.freeze() all nested objects
      Return IntelligenceResult<ImmutableRefinedGoal>
```

---

## Extension Guide

**Adding a new intent type:**
1. Add to `IntentType` union in `types.ts`
2. Add verb array entry in `ACTION_VERB_MAP` in `utils/semantic-parser.ts`
3. If HIGH_RISK, add to `HIGH_RISK_INTENTS` set in `strategy-hint.agent.ts`

**Adding a new capability domain:**
1. Add to `CapabilityDomain` union in `types.ts`
2. Add entry in `DOMAIN_CAPABILITY_MAP` in `capability-mapper.agent.ts`
3. Add to `domainPriority` array in `strategy-hint.agent.ts` if order matters

**Adding a new ambiguity pattern:**
1. Add to `VAGUE_TERMS`, `OVERLOADED_TERMS`, or `MISSING_CONTEXT_PATTERNS`
   in `ambiguity-resolver.agent.ts`
