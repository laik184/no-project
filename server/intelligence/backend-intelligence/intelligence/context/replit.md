# Context Engine

## 1. System Overview
Context Engine backend-intelligence stack ka pure intelligence layer hai. Yeh raw backend signals ko deterministic contextual intelligence me convert karta hai, without code generation ya execution side-effects.

## 2. Folder Responsibilities
- `context.orchestrator.ts` (L1): End-to-end context pipeline ko coordinate karta hai.
- `agents/project-classifier.agent.ts` (L2): Project type, size, aur complexity classify karta hai.
- `agents/framework-context.agent.ts` (L2): Framework, architecture style, aur type-safety infer karta hai.
- `agents/domain-context.agent.ts` (L2): Business domain, risk level, aur data sensitivity infer karta hai.
- `agents/environment-context.agent.ts` (L2): Runtime, deployment model, aur scaling preference infer karta hai.
- `utils/context-map.util.ts` (L3): Deterministic mapping helpers provide karta hai.
- `utils/normalization.util.ts` (L3): Raw inputs normalize/sanitize karta hai.
- `types.ts` (L0): Typed contracts and context models define karta hai.
- `state.ts` (L0): ContextState model aur immutable output conversion manage karta hai.
- `index.ts`: Public exports.

## 3. Call Flow
```text
context.orchestrator
   ↓
project-classifier
   ↓
framework-context
   ↓
domain-context
   ↓
environment-context
   ↓
merge → output
```

## 4. Context Layers Explanation
- **Project**: System topology (monolith/microservice/modular), scale, and complexity score.
- **Framework**: Runtime framework identity, architecture style, and type-safety posture.
- **Domain**: Business domain classification with risk and sensitivity interpretation.
- **Environment**: Runtime family, deployment target, and scaling strategy inference.

## 5. Example Input/Output
### Input
```json
{
  "filePaths": [
    "src/modules/orders/order.controller.ts",
    "src/modules/payments/payment.service.ts",
    "infra/docker/Dockerfile"
  ],
  "dependencies": [
    "express",
    "typescript",
    "stripe"
  ],
  "configKeys": [
    "PAYMENT_PROVIDER",
    "DOCKER_ENABLED"
  ],
  "serviceCount": 2,
  "moduleCount": 7,
  "endpointCount": 42
}
```

### Output
```json
{
  "project": {
    "type": "modular",
    "size": "medium",
    "complexity": 24
  },
  "framework": {
    "framework": "Express",
    "style": "MVC",
    "typeSafety": true
  },
  "domain": {
    "domain": "Fintech",
    "riskLevel": "high",
    "dataSensitivity": "high"
  },
  "environment": {
    "runtime": "Node",
    "deployment": "container",
    "scaling": "vertical"
  }
}
```
