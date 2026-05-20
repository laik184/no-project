# Agent-Capability Module

## Purpose

Build a structured, immutable `AgentCapabilityMatrix` from a set of registered agent descriptors.
This module performs pure, deterministic, in-memory capability analysis with no runtime interaction.

## What It Handles

- Detecting registered agents from a descriptor list
- Identifying agent type (ANALYZER, VALIDATOR, DETECTOR, MAPPER, BUILDER, ORCHESTRATOR, SCANNER, REPORTER, CLASSIFIER, UNKNOWN)
- Identifying agent version and version channel (stable/beta/alpha/deprecated)
- Identifying agent status (active/inactive/degraded/unknown)
- Exposing a structured `AgentCapability` per agent
- Building a full `AgentCapabilityMatrix` with type groupings, counts, and summary

## What It Does NOT Handle

- Executing or calling agents
- Modifying agent state or configuration
- Validating execution plans
- Accessing the filesystem, network, or runtime
- Triggering deployments or orchestration
- Making external API calls

---

## File-by-File Responsibility

| File | Responsibility |
|---|---|
| `types.ts` | All shared interfaces, enums, and constants. Zero logic. |
| `state.ts` | Session lifecycle and matrix history ring-buffer (max 50). Imports types only. |
| `utils/id.helper.ts` | ID generation, counter management, sanitization helpers. |
| `utils/type.helper.ts` | Agent type classification, version channel mapping, groupByType. |
| `registry-scanner.agent.ts` | Validates and normalizes raw `AgentDescriptor[]` → `AgentScanResult[]`. |
| `status-evaluator.agent.ts` | Interprets raw status strings → typed `EvaluatedStatus[]`. |
| `version-mapper.agent.ts` | Parses raw version strings into semver fields → `MappedVersion[]`. |
| `capability-builder.agent.ts` | Combines scan+status+version → `AgentCapability[]` + `AgentCapabilityMatrix`. |
| `agent-capability-orchestrator.ts` | L1 coordinator — drives the pipeline, manages session, stores result. |
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
┌──────▼────────────────────────────┐
│ agent-capability-orchestrator.ts  │
└──────┬────────────────────────────┘
       │
Level 2 — Agents
┌──────▼─────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  ┌─────────────────────┐
│ registry-scanner.agent │  │ status-evaluator.agent│  │ version-mapper.agent│  │ capability-builder  │
└──────┬─────────────────┘  └──────────────────────┘  └────────────────────┘  └─────────────────────┘
       │
Level 3 — Utils
┌──────▼─────────────┐  ┌─────────────────────┐
│  utils/id.helper   │  │ utils/type.helper    │
└────────────────────┘  └─────────────────────┘
```

---

## Call Flow

```
buildCapabilityMatrix(CapabilityInput)
   │
   ├─ createSession()         [state]
   │
   ├─ scanRegistry()          → AgentScanResult[]
   │   ├─ sanitizeId()        [id.helper]
   │   └─ sanitizeName()      [id.helper]
   │
   ├─ evaluateStatus()        → EvaluatedStatus[]
   │
   ├─ mapVersions()           → MappedVersion[]
   │   └─ classifyChannel()   [type.helper]
   │
   ├─ buildMatrix()           → AgentCapabilityMatrix (frozen)
   │   ├─ classifyAgentType() [type.helper]
   │   └─ groupByType()       [type.helper]
   │
   ├─ completeSession()       [state]
   ├─ storeMatrix()           [state]
   └─ return AgentCapabilityMatrix
```

---

## Import Direction Policy

```
ALLOWED:
  index.ts          → orchestrator
  orchestrator      → agents, state, utils, types
  agents            → types, utils
  utils             → types
  state             → types ONLY

FORBIDDEN:
  agents → agents        (no peer-to-peer)
  state  → agents
  utils  → agents
  types  → anything      (leaf node — pure data)
  circular imports of any kind
```

---

## Severity/Status Mapping

| Raw Status Token | Resolved Status |
|---|---|
| active, running, online, enabled, up | `active` |
| degraded, partial, warning, unstable | `degraded` |
| inactive, stopped, offline, disabled, down | `inactive` |
| anything else | `unknown` |

## Version Channel Mapping

| Version Contains | Channel |
|---|---|
| (clean semver, no suffix) | `stable` |
| `-beta`, `-rc`, `-preview` | `beta` / `alpha` |
| `deprecated`, `legacy` | `deprecated` |
| major = 0 (e.g. 0.x.x) | `deprecated` |

---

## Example Input

```typescript
const input: CapabilityInput = {
  scanContext: "production-scan",
  agents: [
    {
      id:           "agent-001",
      name:         "Config Drift Analyzer",
      type:         "analyzer",
      version:      "2.1.4",
      status:       "active",
      tags:         ["config", "drift"],
      registeredAt: 1700000000000,
    },
    {
      id:      "agent-002",
      name:    "Port Validator",
      type:    "validator",
      version: "1.0.0-beta",
      status:  "degraded",
      tags:    ["ports", "validation"],
    },
    {
      id:      "agent-003",
      name:    "Image Scanner",
      type:    "scanner",
      version: "3.0.2",
      status:  "inactive",
    },
  ],
};

const matrix = buildCapabilityMatrix(input);
```

## Example Output

```json
{
  "matrixId":      "acm-1-1700000000001",
  "generatedAt":   1700000000001,
  "totalAgents":   3,
  "activeCount":   1,
  "inactiveCount": 1,
  "summary":       "Capability matrix: 3 agent(s) — 1 active, 1 inactive, 1 other.",
  "capabilities": [
    {
      "agentId":       "agent-001",
      "name":          "Config Drift Analyzer",
      "type":          "ANALYZER",
      "isOperational": true,
      "tags":          ["config", "drift"],
      "registeredAt":  1700000000000,
      "version":  { "version": "2.1.4", "channel": "stable", "major": 2, "minor": 1, "patch": 4, "isValid": true },
      "status":   { "status": "active", "isActive": true, "statusReason": "Agent is active (raw: \"active\")." }
    },
    {
      "agentId":       "agent-002",
      "name":          "Port Validator",
      "type":          "VALIDATOR",
      "isOperational": false,
      "tags":          ["ports", "validation"],
      "version":  { "version": "1.0.0-beta", "channel": "beta", "major": 1, "minor": 0, "patch": 0, "isValid": true },
      "status":   { "status": "degraded", "isActive": false, "statusReason": "Agent is degraded..." }
    },
    {
      "agentId":       "agent-003",
      "name":          "Image Scanner",
      "type":          "SCANNER",
      "isOperational": false,
      "tags":          [],
      "version":  { "version": "3.0.2", "channel": "stable", "major": 3, "minor": 0, "patch": 2, "isValid": true },
      "status":   { "status": "inactive", "isActive": false, "statusReason": "Agent is inactive (raw: \"inactive\")." }
    }
  ],
  "byType": {
    "ANALYZER":  [...],
    "VALIDATOR": [...],
    "SCANNER":   [...]
  }
}
```

---

## State Lifecycle

```
IDLE → SCANNING → EVALUATING → MAPPING → BUILDING → COMPLETE
                                                   ↘ FAILED
```

- One session created per `buildCapabilityMatrix()` call
- Matrix history ring-buffer: last 50 matrices retained
- `clearAll()` resets all state (safe for tests and hot-reload)
