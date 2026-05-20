# Discovery Layer

## Purpose

Discover all registered capabilities from a raw source catalog and produce an immutable `DiscoverySnapshot`. This layer surfaces what is available — it does not evaluate, score, gate, or govern any capability.

## What It Handles

- Discovering registered **agents** with their domain and tags
- Discovering supported **runtimes** with version and platform
- Discovering supported **integrations** with type and protocol
- Discovering **deployment** targets and their readiness signals
- Discovering supported **languages** with file extension and ecosystem

## What It Does NOT Handle

- Compatibility evaluation
- Feature gating or flags
- Scoring or ranking
- Executing or calling agents
- Modifying global state
- Governance or policy enforcement
- Environment mutation
- Network or filesystem access

---

## File-by-File Responsibility

| File | Responsibility |
|---|---|
| `types.ts` | All shared interfaces, type aliases, and constants. Zero logic. |
| `state.ts` | Session lifecycle, raw result storage, snapshot ring-buffer (max 50). Imports types only. |
| `utils/normalizer.helper.ts` | String normalization: IDs, names, slugs, tags, versions, extensions. |
| `utils/dedupe.helper.ts` | Deduplication by ID, name, or both. String deduplication. |
| `agent-discovery.agent.ts` | Filters `AGENT` sources → `DiscoveredAgent[]` |
| `runtime-discovery.agent.ts` | Filters `RUNTIME` sources → `DiscoveredRuntime[]` |
| `integration-discovery.agent.ts` | Filters `INTEGRATION` sources → `DiscoveredIntegration[]` |
| `deployment-discovery.agent.ts` | Filters `DEPLOYMENT` sources → `DiscoveredDeployment[]` |
| `language-discovery.agent.ts` | Filters `LANGUAGE` sources → `DiscoveredLanguage[]` |
| `discovery-orchestrator.ts` | L1 coordinator — drives discovery pipeline, merges results, manages state. |
| `index.ts` | Public re-export surface only. |

---

## HVP Layer Diagram

```
Level 0 — Public Surface
┌──────────────┐
│   index.ts   │
└──────┬───────┘
       │
Level 1 — Orchestration
┌──────▼────────────────────────┐
│  discovery-orchestrator.ts    │
└──────┬────────────────────────┘
       │
Level 2 — Discovery Agents
┌──────▼──────────────┐  ┌───────────────────────┐  ┌─────────────────────────┐
│ agent-discovery     │  │ runtime-discovery      │  │ integration-discovery   │
└─────────────────────┘  └───────────────────────┘  └─────────────────────────┘
┌─────────────────────┐  ┌───────────────────────┐
│ deployment-discovery│  │ language-discovery     │
└──────┬──────────────┘  └──────┬────────────────┘
       │                        │
Level 3 — Utils
┌──────▼──────────────────┐  ┌──────────────────────────┐
│ utils/normalizer.helper │  │ utils/dedupe.helper       │
└─────────────────────────┘  └──────────────────────────┘
```

---

## Call Flow

```
runDiscovery(DiscoveryInput)
   │
   ├─ createSession()            [state]
   ├─ buildSourceSummary()
   │
   ├─ discoverAgents()           → DiscoveredAgent[]
   │   ├─ filter kind=AGENT
   │   ├─ normalizeId/Name/Slug  [normalizer.helper]
   │   └─ dedupeByIdAndName()    [dedupe.helper]
   │
   ├─ discoverRuntimes()         → DiscoveredRuntime[]
   ├─ discoverIntegrations()     → DiscoveredIntegration[]
   ├─ discoverDeployments()      → DiscoveredDeployment[]
   ├─ discoverLanguages()        → DiscoveredLanguage[]
   │
   ├─ merge all results
   ├─ storeRawResult()           [state]
   │
   ├─ completeSession()          [state]
   ├─ addSnapshot()              [state]
   └─ return DiscoverySnapshot   (frozen)
```

---

## Import Direction Policy

```
ALLOWED:
  index.ts         → orchestrator
  orchestrator     → agents, state, types
  agents           → types, utils
  utils            → types
  state            → types ONLY

FORBIDDEN:
  agents  → agents       (no peer-to-peer)
  state   → agents
  utils   → agents
  types   → anything     (leaf node)
  any import from: evaluation, intelligence-scoring, governance,
                   runtime-control, planner, execution
```

---

## Example Input

```typescript
const input: DiscoveryInput = {
  context: "production-audit",
  sources: [
    {
      kind: "AGENT",
      id:   "agent-drift-001",
      name: "Config Drift Analyzer",
      metadata: { domain: "configuration", tags: ["drift", "config"] },
    },
    {
      kind: "RUNTIME",
      id:   "rt-node-20",
      name: "Node.js",
      metadata: { version: "20.11.0", platform: "linux" },
    },
    {
      kind: "INTEGRATION",
      id:   "int-stripe-001",
      name: "Stripe",
      metadata: { type: "payment", protocol: "rest" },
    },
    {
      kind: "DEPLOYMENT",
      id:   "dep-prod-001",
      name: "Production Cluster",
      metadata: { target: "production", readinessSignal: "healthy" },
    },
    {
      kind: "LANGUAGE",
      id:   "lang-ts-001",
      name: "TypeScript",
      metadata: { extension: ".ts", ecosystem: "node" },
    },
  ],
};

const snapshot = runDiscovery(input);
```

## Example Output — `DiscoverySnapshot`

```json
{
  "snapshotId":      "dss-1-1700000000001",
  "discoveredAt":    1700000000001,
  "totalDiscovered": 5,
  "agents": [
    { "id": "agent-drift-001", "name": "Config Drift Analyzer", "domain": "configuration", "tags": ["drift", "config"] }
  ],
  "runtimes": [
    { "id": "rt-node-20", "name": "Node.js", "version": "20.11.0", "platform": "linux" }
  ],
  "integrations": [
    { "id": "int-stripe-001", "name": "Stripe", "type": "payment", "protocol": "rest" }
  ],
  "deployments": [
    { "id": "dep-prod-001", "name": "Production Cluster", "target": "production", "readinessSignal": "healthy" }
  ],
  "languages": [
    { "id": "lang-ts-001", "name": "TypeScript", "extension": ".ts", "ecosystem": "node" }
  ],
  "sourceSummary": {
    "totalSources": 5,
    "byKind": { "AGENT": 1, "RUNTIME": 1, "INTEGRATION": 1, "DEPLOYMENT": 1, "LANGUAGE": 1 },
    "discoveredAt": 1700000000001
  }
}
```

---

## State Lifecycle

```
IDLE → AGENTS → RUNTIMES → INTEGRATIONS → DEPLOYMENTS → LANGUAGES → MERGING → COMPLETE
                                                                              ↘ FAILED
```

- One session per `runDiscovery()` call
- Snapshot history ring-buffer: last 50 snapshots retained
- `clearAll()` resets all state (safe for tests and hot-reload)
