# Backend-Intelligence Module

**Module:** `Backend-Agent/agents/backend-intelligence/`
**Role:** The cognitive brain of the Nura-X deployer. Analyses backend projects, generates code, evaluates deployment readiness, selects frameworks/databases, and enforces security policy.
**Pattern:** High Cohesion + Low Coupling — every sub-module owns exactly one responsibility and communicates only through its public `index.ts` surface.

---

## Module Map (who calls whom)

```
index.ts
├── analysis/index.ts
│   ├── api-scanner/           → scan(), fetchReport(), getScanHistory(), getStats()
│   ├── backend-architecture/  → analyzeArchitecture()
│   ├── code-smell-detector/   → detectSmells()
│   ├── cross-intelligence/    → runCrossIntelligence()
│   ├── framework-detector/    → detect()
│   ├── performance-analyzer/  → analyzePerformance()
│   └── schema-inferencer/     → inferSchema()
│
├── backend-code-generator/index.ts
│   └── generate()             → engine → templates/* + entity/* + repository/* + service/* + controller/* + routes/* + openapi/* + middleware/* + validation/* + contracts/* + config/* + error/*
│
├── backend-deployment-gate/index.ts
│   └── evaluate()             → architecture-check + migration-check + security-check + config-check + environment-check → scoring → risk
│
├── decision/index.ts
│   ├── backend-framework/     → select()
│   ├── backend-risk-decision/ → decide()
│   ├── database-engine-selection/ → choose()
│   ├── priority/              → rankPriorities()
│   └── strategy/              → buildStrategy()
│
├── security/index.ts
│   ├── backend-security-policy/ → generate()
│   └── backend-threat-model/    → analyze()
│
└── intelligence/index.ts
    ├── consistency/           → runConsistencyEngine()
    ├── context/               → buildContext()
    ├── quality/               → scoreQuality()
    ├── recommendation/        → generateRecommendations()
    └── report/                → buildReport()
```

---

## 1. `analysis/` — Static Code Analysis

### `api-scanner/`
Scans a backend codebase and identifies all API endpoints, protocols, versioning, and metadata.

| File | Role |
|------|------|
| `api-scanner-orchestrator.ts` | Entry: `scan()` — runs all detectors and aggregates results |
| `types.ts` | All type definitions (ScanInput, ApiScanReport, RestEndpoint, etc.) |
| `state.ts` | Immutable state management for scan sessions |
| `core/rest-detector.ts` | Detects REST endpoints via route patterns |
| `core/graphql-detector.ts` | Detects GraphQL schemas, queries, mutations |
| `core/rpc-detector.ts` | Detects gRPC / tRPC patterns |
| `core/websocket-detector.ts` | Detects WebSocket upgrade handlers |
| `core/versioning-detector.ts` | Detects API versioning strategies (path, header, query) |
| `core/endpoint-metadata-extractor.ts` | Extracts auth, rate-limit, and other metadata from endpoints |
| `core/index.ts` | Re-exports all core detectors |
| `utils/pattern.matcher.ts` | Shared regex/pattern matching utilities |
| `utils/deep.freeze.ts` | Immutable state helper |
| `utils/index.ts` | Re-exports utils |
| `validators/scan-input.validator.ts` | Validates ScanInput before processing |
| `validators/index.ts` | Re-exports validators |
| `index.ts` | Public surface: `scan`, `fetchReport`, `getScanHistory`, `getStats` |

**Call Graph:** `scan()` → `scanInput.validator` → `restDetector + graphqlDetector + rpcDetector + wsDetector + versioningDetector` → `endpointMetadataExtractor` → state

---

### `backend-architecture/`
Analyses the architectural structure, layering, dependency cycles, and domain boundaries.

| File | Role |
|------|------|
| `backend-architecture.engine.ts` | Entry: `analyzeArchitecture()` — orchestrates all sub-analysers |
| `types.ts` | Flat types re-export for backward compatibility |
| `state.ts` | Immutable analysis state |
| `types/architecture.types.ts` | Core architecture type definitions |
| `types/blueprint.types.ts` | Blueprint generation types |
| `types/dependency.types.ts` | Dependency graph types |
| `types/layering.types.ts` | Layer violation types |
| `types/index.ts` | Re-exports all types |
| `blueprint/architecture.blueprint.generator.ts` | Generates architecture blueprint from analysis |
| `blueprint/index.ts` | Re-exports `generateArchitectureBlueprint` |
| `classification/architecture.classifier.ts` | Classifies pattern: MVC, Hexagonal, Clean, etc. |
| `classification/index.ts` | Re-exports `classifyArchitecturePattern` |
| `complexity/architecture.complexity.scorer.ts` | Scores structural complexity (lines, coupling, cohesion) |
| `complexity/index.ts` | Re-exports scorer |
| `dependency/cycle.detector.ts` | Detects circular dependencies using DFS |
| `dependency/dependency.direction.analyzer.ts` | Checks unidirectional dependency rules |
| `dependency/index.ts` | Re-exports cycle detector and direction analyzer |
| `domain/domain.leakage.detector.ts` | Detects cross-domain boundary violations |
| `domain/index.ts` | Re-exports domain leakage detector |
| `layering/layering.violation.detector.ts` | Detects layer violation (controller→repo direct, etc.) |
| `layering/index.ts` | Re-exports layering violation detector |
| `index.ts` | Public surface: `analyzeArchitecture`, all types |

---

### `code-smell-detector/`
Detects anti-patterns and technical debt: god classes, long methods, dead code, duplications.

| File | Role |
|------|------|
| `smell-orchestrator.ts` | Entry: `detectSmells()` — runs all smell detectors |
| `types.ts` | SmellInput, SmellResult, SmellCategory types |
| `state.ts` | Immutable smell detection state |
| `core/` | Individual smell detectors (god-class, long-method, dead-code, etc.) |
| `scoring/severity.scorer.ts` | Scores smell severity (critical/high/medium/low) |
| `scoring/smell.aggregator.ts` | Aggregates individual smell reports into a summary |
| `scoring/index.ts` | Re-exports scoring |
| `utils/ast.helper.ts` | AST traversal helpers |
| `utils/metric.utils.ts` | Cyclomatic complexity, LOC metrics |
| `utils/deep.freeze.ts` | Immutable state helper |
| `utils/index.ts` | Re-exports utils |
| `validators/input.validator.ts` | Validates smell detection input |
| `validators/index.ts` | Re-exports validators |
| `index.ts` | Public surface: `detectSmells`, all types |

---

### `cross-intelligence/`
Combines outputs from multiple analysers into correlated multi-signal insights.

| File | Role |
|------|------|
| `cross-intelligence.orchestrator.ts` | Entry: `runCrossIntelligence()` — fans out to all signal agents |
| `types.ts` | CrossIntelligenceInput, CrossIntelligenceOutput, Signal types |
| `state.ts` | Immutable cross-intelligence state |
| `agents/correlation.engine.agent.ts` | Correlates signals across different analysers |
| `agents/multi-signal.analyzer.agent.ts` | Analyses overlapping signals from multiple sources |
| `agents/insight.synthesizer.agent.ts` | Synthesises actionable insights from correlated signals |
| `agents/index.ts` | Re-exports all agents |
| `utils/merge.util.ts` | Merges analysis outputs into a unified signal map |
| `utils/weight.util.ts` | Weights signals by confidence and severity |
| `utils/index.ts` | Re-exports utils |
| `index.ts` | Public surface: `runCrossIntelligence`, all types |

**Depends on:** outputs from `api-scanner`, `backend-architecture`, `code-smell-detector`, `performance-analyzer`, `security`

---

### `framework-detector/`
Detects which backend framework a project uses (Express, NestJS, Django, Rails, Spring Boot, etc.)

| File | Role |
|------|------|
| `framework-orchestrator.ts` | Entry: `detect()` — runs all detection strategies |
| `types.ts` | DetectionInput, FrameworkDetectionResult types |
| `state.ts` | Detection session state |
| `core/bootstrap-detector.ts` | Detects framework via app bootstrap patterns |
| `core/confidence-calculator.ts` | Computes detection confidence score (0–1) |
| `core/dependency-scanner.ts` | Scans package.json / requirements.txt for framework deps |
| `core/import-pattern-detector.ts` | Detects framework via import patterns |
| `core/middleware-pattern-detector.ts` | Detects via middleware registration patterns |
| `core/routing-style-detector.ts` | Detects via routing style (decorators, router.get, etc.) |
| `core/index.ts` | Re-exports all core detectors |
| `signatures/node.signatures.ts` | Signature rules for Node.js frameworks |
| `signatures/python.signatures.ts` | Signature rules for Python frameworks |
| `signatures/java.signatures.ts` | Signature rules for Java frameworks |
| `signatures/php.signatures.ts` | Signature rules for PHP frameworks |
| `signatures/index.ts` | Re-exports all signatures |
| `utils/pattern.matcher.ts` | Regex pattern matcher |
| `utils/score.utils.ts` | Score normalisation utilities |
| `utils/deep.freeze.ts` | Immutable state helper |
| `utils/index.ts` | Re-exports utils |
| `validators/detection-input.validator.ts` | Validates detection input |
| `validators/index.ts` | Re-exports validators (but only detection-input) |
| `index.ts` | Public surface: `detect`, all types |

---

### `performance-analyzer/`
Identifies backend performance bottlenecks: N+1 queries, blocking I/O, middleware weight, route latency.

| File | Role |
|------|------|
| `performance-orchestrator.ts` | Entry: `analyzePerformance()` — runs all detectors |
| `types.ts` | PerformanceInput, PerformanceReport, BottleneckType types |
| `state.ts` | Analysis session state |
| `core/db-query-pattern.detector.ts` | Detects problematic DB query patterns |
| `core/nplusone.detector.ts` | Detects N+1 query patterns in ORM usage |
| `core/middleware-weight.analyzer.ts` | Analyses middleware cost in request pipeline |
| `core/route-latency.scorer.ts` | Estimates expected route latency |
| `core/index.ts` | Re-exports all core detectors |
| `utils/` | Performance analysis utilities |
| `utils/index.ts` | Re-exports utils |
| `validators/` | Input validators |
| `validators/index.ts` | Re-exports validators |
| `index.ts` | Public surface: `analyzePerformance`, all types |

---

### `schema-inferencer/`
Infers data schemas from code (ORM models, DTOs, validation schemas, raw SQL).

| File | Role |
|------|------|
| `schema-inferencer.engine.ts` | Entry: `inferSchema()` — selects strategy and runs inference |
| `db-strategy.selector.ts` | Selects the right inference strategy based on ORM/DB type |
| `types.ts` | InferenceInput, SchemaOutput, FieldDescriptor types |
| `state.ts` | Inference session state |
| `utils/` | Schema normalisation, type mapping utilities |
| `utils/index.ts` | Re-exports utils |
| `validators/` | Input validators |
| `validators/index.ts` | Re-exports validators |
| `index.ts` | Public surface: `inferSchema`, all types |

---

## 2. `backend-code-generator/` — Code Generation Engine

Generates a complete, runnable backend project scaffold from a `BackendCodeGenerationInput`.

| File | Role |
|------|------|
| `backend-code-generator.engine.ts` | Entry: `generate()` — orchestrates all generators |
| `types/backend.codegen.types.ts` | Core types: GeneratedFile, ProjectMetadata, BackendCodeGenerationInput/Output |
| `types/contract.codegen.types.ts` | Framework enum, PackageManager, FrameworkDependencies |
| `types/controller.codegen.types.ts` | Controller generation types |
| `types/entity.codegen.types.ts` | Entity / model generation types |
| `types/framework.codegen.types.ts` | Framework capability and dependency types |
| `types/openapi.codegen.types.ts` | OpenAPI spec generation types |
| `types/repository.codegen.types.ts` | Repository pattern types |
| `types/route.codegen.types.ts` | Route generation types |
| `types/service.codegen.types.ts` | Service layer types |
| `types/template.codegen.types.ts` | Template rendering types |
| `types/validation.codegen.types.ts` | Validation schema types |
| `types/architecture.codegen.types.ts` | Architecture-level codegen types |
| `types/index.ts` | Re-exports all codegen types |
| `templates/*.bootstrap.template.ts` | 30+ framework bootstrap files (Express, Fastify, NestJS, Django, Rails, Spring Boot, Gin, Axum, Laravel, etc.) |
| `templates/dockerfile.template.ts` | Generates Dockerfile + docker-compose.yml |
| `templates/ci.pipeline.template.ts` | Generates GitHub Actions CI pipeline |
| `templates/eslint.template.ts` | Generates ESLint config |
| `templates/env.template.ts` | Generates .env.example |
| `templates/healthcheck.template.ts` | Generates /health endpoint |
| `templates/logging.template.ts` | Generates logger config |
| `templates/package.json.template.ts` | Generates package.json |
| `templates/readme.template.ts` | Generates README.md |
| `templates/tsconfig.template.ts` | Generates tsconfig.json |
| `templates/test.unit.template.ts` | Generates unit test scaffold |
| `templates/test.integration.template.ts` | Generates integration test scaffold |
| `templates/index.ts` | Re-exports all 48 templates |
| `entity/entity.model.generator.ts` | Generates entity/model classes |
| `entity/dto.generator.ts` | Generates DTOs (create/update/response) |
| `entity/index.ts` | Re-exports entity generators |
| `repository/repository.generator.ts` | Generates repository interfaces and implementations |
| `repository/index.ts` | Re-exports repository generator |
| `service/service.generator.ts` | Generates service layer with CRUD logic |
| `service/index.ts` | Re-exports service generator |
| `controller/controller.generator.ts` | Generates controllers with route handlers |
| `controller/index.ts` | Re-exports controller generator |
| `routes/route.generator.ts` | Generates route registration code |
| `routes/index.ts` | Re-exports route generator |
| `openapi/openapi.spec.generator.ts` | Generates OpenAPI 3.0 specification |
| `openapi/index.ts` | Re-exports OpenAPI generator |
| `middleware/middleware.generator.ts` | Generates auth/logging/error middleware |
| `middleware/index.ts` | Re-exports middleware generator |
| `validation/validation.schema.generator.ts` | Generates Zod/Joi/class-validator schemas |
| `validation/index.ts` | Re-exports validation generator |
| `contracts/api.contract.generator.ts` | Generates API contract types and response wrappers |
| `contracts/index.ts` | Re-exports contract generator |
| `config/config.loader.generator.ts` | Generates type-safe config loader |
| `config/index.ts` | Re-exports config generator |
| `error/error.handler.generator.ts` | Generates global error handler middleware |
| `error/index.ts` | Re-exports error handler generator |
| `index.ts` | Public surface: `generate`, core types |

**Call Graph:** `generate()` → `CODEGEN_DEFAULTS + FRAMEWORK_DEPENDENCIES` → `templates/*` + `entity/*` + `repository/*` + `service/*` + `controller/*` + `routes/*` + `openapi/*` + `middleware/*` + `validation/*` + `contracts/*` + `config/*` + `error/*`

---

## 3. `backend-deployment-gate/` — Pre-Deployment Validation

Validates a project before deployment. Scores it and makes a PASS/FAIL/WARN decision.

| File | Role |
|------|------|
| `backend-deployment-gate.engine.ts` | Entry: `evaluate()` — runs all checks and computes gate score |
| `types/deployment.input.types.ts` | DeploymentGateInput, ArchitectureSpec, SecuritySpec, MigrationSpec, etc. |
| `types/deployment.result.types.ts` | CheckResult, DeploymentGateResult, DecisionOutcome |
| `types/risk.types.ts` | RiskBand, RiskFactor |
| `types/index.ts` | Re-exports all deployment gate types |
| `architecture-check/architecture.readiness.check.ts` | Checks architectural compliance (layer violations, cycles) |
| `architecture-check/index.ts` | Re-exports `architecture.readiness.check` |
| `migration-check/migration.safety.check.ts` | Checks DB migration safety (destructive ops, rollback plan) |
| `migration-check/index.ts` | Re-exports migration check |
| `security-check/security.compliance.check.ts` | Checks CORS, auth headers, HTTPS, secrets exposure |
| `security-check/index.ts` | Re-exports security check |
| `config-check/config.completeness.check.ts` | Checks required env vars, config completeness |
| `config-check/index.ts` | Re-exports config check |
| `environment-check/environment.validation.check.ts` | Validates target environment compatibility |
| `environment-check/index.ts` | Re-exports environment check |
| `scoring/deployment.score.calculator.ts` | Computes weighted deployment readiness score |
| `scoring/index.ts` | Re-exports scorer |
| `risk/deployment.risk.calculator.ts` | Converts score to risk band (LOW/MEDIUM/HIGH/CRITICAL) |
| `risk/index.ts` | Re-exports risk calculator |
| `readiness/build.command.check.ts` | Verifies build command exists and succeeds |
| `readiness/readiness.checks.ts` | Aggregates all readiness checks |
| `readiness/index.ts` | Re-exports readiness checks |
| `index.ts` | Public surface: `evaluate`, all types |

**Call Graph:** `evaluate()` → `architectureCheck + migrationCheck + securityCheck + configCheck + environmentCheck` → `scoring` → `risk` → `DecisionOutcome`

---

## 4. `decision/` — Technology Decision Engine

### `backend-framework/`
Selects the optimal backend framework based on team preferences, project requirements, and scalability needs.

| File | Role |
|------|------|
| `backend-framework.engine.ts` | Entry: `select()` |
| `types/framework.types.ts` | FrameworkName, FrameworkLanguage, FrameworkCapability |
| `types/requirement.types.ts` | BackendFrameworkSelectionInput (team, scale, api-style, etc.) |
| `types/scoring.types.ts` | DimensionFitScores, FrameworkTotalScore |
| `types/report.types.ts` | BackendFrameworkSelectionReport |
| `types/index.ts` | Re-exports all framework types |
| `analysis/language.preference.analyzer.ts` | Analyses language preference from team profile |
| `analysis/index.ts` | Re-exports analysis |
| `capability/framework.capability.matrix.ts` | Defines each framework's capability scores |
| `capability/index.ts` | Re-exports capability matrix |
| `compatibility/compatibility.validator.ts` | Validates framework-language compatibility |
| `compatibility/index.ts` | Re-exports compatibility validator |
| `scoring/framework.scorer.ts` | Scores each framework against requirements |
| `scoring/index.ts` | Re-exports scorer |
| `selection/framework.selector.ts` | Selects top framework from ranked scores |
| `selection/index.ts` | Re-exports selector |
| `index.ts` | Public surface: `select`, all types |

---

### `database-engine-selection/`
Selects optimal database engine (PostgreSQL, MongoDB, MySQL, Redis, etc.) for the project.

| File | Role |
|------|------|
| `database-engine-selection.engine.ts` | Entry: `choose()` |
| `types/` | Database selection types (DatabaseCapability, DatabaseScore, etc.) |
| `types/index.ts` | Re-exports types |
| `analysis/` | Analyses data model requirements (relational vs document, etc.) |
| `analysis/index.ts` | Re-exports analysis |
| `capability/database.capability.matrix.ts` | Maps database capabilities (ACID, horizontal scale, etc.) |
| `capability/index.ts` | Re-exports capability matrix |
| `compatibility/compatibility.validator.ts` | Validates DB-framework compatibility |
| `compatibility/index.ts` | Re-exports compatibility validator |
| `scoring/` | Scores databases against requirements |
| `scoring/index.ts` | Re-exports scorer |
| `selection/` | Selects the winning database engine |
| `selection/index.ts` | Re-exports selector |
| `index.ts` | Public surface: `choose`, all types |

---

### `backend-risk-decision/`
Evaluates composite risk across architecture, deployment, integrity, scalability, and security dimensions.

| File | Role |
|------|------|
| `backend-risk-decision.engine.ts` | Entry: `decide()` |
| `types/risk.types.ts` | BackendRiskInput, RiskEvaluation, RiskDecisionReport |
| `types/architecture-risk.types.ts` | ArchitectureRiskSpec |
| `types/deployment-risk.types.ts` | DeploymentRiskSpec |
| `types/integrity-risk.types.ts` | IntegrityRiskSpec |
| `types/scalability-risk.types.ts` | ScalabilityRiskSpec |
| `types/security-risk.types.ts` | SecurityRiskSpec |
| `types/index.ts` | Re-exports all risk types |
| `architecture/architecture.risk.evaluator.ts` | Evaluates architecture risk (coupling, complexity, patterns) |
| `architecture/index.ts` | Re-exports architecture evaluator |
| `deployment/deployment.risk.evaluator.ts` | Evaluates deployment risk (replicas, health checks, rollback) |
| `deployment/index.ts` | Re-exports deployment evaluator |
| `integrity/integrity.risk.evaluator.ts` | Evaluates data integrity risk (transactions, rollbacks, locking) |
| `integrity/index.ts` | Re-exports integrity evaluator |
| `scalability/scalability.risk.evaluator.ts` | Evaluates scalability risk (caching, async, load) |
| `scalability/index.ts` | Re-exports scalability evaluator |
| `security/security.risk.evaluator.ts` | Evaluates security risk (auth, HTTPS, secrets) |
| `security/index.ts` | Re-exports security evaluator |
| `scoring/` | Weighted composite risk scoring |
| `scoring/index.ts` | Re-exports scorer |
| `index.ts` | Public surface: `decide`, all types |

---

### `priority/`
Ranks and orders recommended actions by impact and effort.

| File | Role |
|------|------|
| `priority.orchestrator.ts` | Entry: `rankPriorities()` |
| `agents/` | Priority scoring agents |
| `agents/index.ts` | Re-exports agents |
| `utils/` | Priority computation utilities |
| `utils/index.ts` | Re-exports utils |
| `index.ts` | Public surface |

---

### `strategy/`
Builds a structured backend migration/build strategy from analysis results.

| File | Role |
|------|------|
| `strategy.orchestrator.ts` | Entry: `buildStrategy()` |
| `agents/` | Strategy construction agents |
| `agents/index.ts` | Re-exports agents |
| `utils/plan.util.ts` | Generates phased implementation plans |
| `utils/index.ts` | Re-exports utils |
| `index.ts` | Public surface |

---

## 5. `security/` — Security Analysis & Policy

### `backend-security-policy/`
Generates a comprehensive security policy for a backend project.

| File | Role |
|------|------|
| `backend-security-policy.engine.ts` | Entry: `generate()` — runs all policy generators |
| `types/security.policy.types.ts` | SecurityPolicyInput, SecurityPolicyModel |
| `types/cors.policy.types.ts` | CORS policy types |
| `types/rbac.types.ts` | Role-based access control types |
| `types/rate-limit.policy.types.ts` | Rate limit policy types |
| `types/encryption.policy.types.ts` | Encryption policy types |
| `types/token.policy.types.ts` | Token/JWT policy types |
| `types/audit.policy.types.ts` | Audit logging policy types |
| `types/sensitivity.types.ts` | Data sensitivity classification types |
| `types/awareness.types.ts` | Security awareness types |
| `types/index.ts` | Re-exports all policy types |
| `cors/cors.policy.generator.ts` | Generates CORS policy (origins, methods, headers) |
| `cors/index.ts` | Re-exports CORS generator |
| `rbac/role.model.generator.ts` | Generates role model (admin/user/service roles) |
| `rbac/permission.matrix.generator.ts` | Generates endpoint permission matrix |
| `rbac/index.ts` | Re-exports RBAC generators |
| `rate-limit/rate.limit.policy.generator.ts` | Generates rate limit policy |
| `rate-limit/index.ts` | Re-exports rate limit generator |
| `encryption/encryption.policy.generator.ts` | Generates encryption policy (AES, TLS requirements) |
| `encryption/index.ts` | Re-exports encryption generator |
| `token/token.policy.generator.ts` | Generates JWT/session token policy |
| `token/index.ts` | Re-exports token generator |
| `audit/audit.policy.generator.ts` | Generates audit logging policy |
| `audit/index.ts` | Re-exports audit generator |
| `sensitivity/data.classification.generator.ts` | Classifies data sensitivity (PII, financial, public) |
| `sensitivity/index.ts` | Re-exports data classification generator |
| `violations/policy.violation.rules.generator.ts` | Generates policy violation detection rules |
| `violations/index.ts` | Re-exports violation rules generator |
| `awareness/secret.pattern.scanner.ts` | Scans for hardcoded secrets and credentials |
| `awareness/debug.mode.detector.ts` | Detects debug mode enabled in production |
| `awareness/source.exposure.checker.ts` | Detects source code exposure risks |
| `awareness/source.scan.engine.ts` | Orchestrates awareness scan |
| `awareness/index.ts` | Re-exports awareness scanners (excludes test file) |
| `index.ts` | Public surface: `generate`, core types |

---

### `backend-threat-model/`
Models security threats using STRIDE methodology and scores risk.

| File | Role |
|------|------|
| `backend-threat-model.engine.ts` | Entry: `analyze()` — runs all threat detectors |
| `types/threat.types.ts` | BackendThreatModelInput, BackendThreatModelReport, RiskLevel |
| `types/stride.types.ts` | STRIDE threat category types |
| `types/attack-surface.types.ts` | API attack surface types |
| `types/risk.types.ts` | Risk scoring types |
| `types/index.ts` | Re-exports all threat model types |
| `stride/spoofing.detector.ts` | Detects identity spoofing threats |
| `stride/tampering.detector.ts` | Detects data tampering threats |
| `stride/repudiation.detector.ts` | Detects non-repudiation issues |
| `stride/information-disclosure.detector.ts` | Detects data leakage threats |
| `stride/denial-of-service.detector.ts` | Detects DoS vulnerabilities |
| `stride/elevation-of-privilege.detector.ts` | Detects privilege escalation paths |
| `stride/index.ts` | Re-exports all STRIDE detectors |
| `injection/injection.detector.ts` | Detects SQL/Command/LDAP injection vectors |
| `injection/index.ts` | Re-exports injection detector |
| `xss/xss-orchestrator.ts` | Orchestrates XSS detection (DOM, stored, reflected) |
| `xss/dom-xss.detector.ts` | Detects DOM-based XSS |
| `xss/stored-xss.detector.ts` | Detects stored XSS patterns |
| `xss/reflected-xss.detector.ts` | Detects reflected XSS patterns |
| `xss/injection-point.analyzer.ts` | Analyses user input injection points |
| `xss/pattern-matcher.ts` | XSS pattern matching utilities |
| `xss/risk-scorer.ts` | Scores XSS risk severity |
| `xss/types.ts` | XSS-specific types |
| `xss/state.ts` | XSS detection state |
| `xss/utils/deep-freeze.ts` | Immutable state helper |
| `xss/utils/regex.helper.ts` | XSS regex utilities |
| `xss/utils/string-sanitizer-check.ts` | Checks for sanitizer usage |
| `xss/utils/index.ts` | Re-exports XSS utils |
| `xss/validators/input.validator.ts` | Validates XSS detection input |
| `xss/validators/payload.validator.ts` | Validates XSS payload data |
| `xss/validators/index.ts` | Re-exports XSS validators |
| `xss/index.ts` | Re-exports XSS module |
| `csrf/csrf-orchestrator.ts` | Orchestrates CSRF detection |
| `csrf/cookie-analyzer.service.ts` | Analyses cookie security attributes |
| `csrf/origin-validator.service.ts` | Validates Origin/Referer header checks |
| `csrf/token-checker.service.ts` | Checks CSRF token implementation |
| `csrf/risk-scorer.service.ts` | Scores CSRF risk |
| `csrf/types.ts` | CSRF-specific types |
| `csrf/state.ts` | CSRF detection state |
| `csrf/utils/deep-freeze.ts` | Immutable state helper |
| `csrf/utils/header-parser.ts` | Parses HTTP security headers |
| `csrf/utils/string.helper.ts` | String utilities |
| `csrf/utils/index.ts` | Re-exports CSRF utils |
| `csrf/validators/header.validator.ts` | Validates header data |
| `csrf/validators/request.validator.ts` | Validates request structure |
| `csrf/validators/index.ts` | Re-exports CSRF validators |
| `csrf/index.ts` | Re-exports CSRF module |
| `auth/auth.flow.analyzer.ts` | Analyses authentication flow security |
| `auth/privilege.escalation.detector.ts` | Detects privilege escalation paths |
| `auth/index.ts` | Re-exports auth analysis |
| `config/insecure.config.detector.ts` | Detects insecure configuration settings |
| `config/index.ts` | Re-exports config detector |
| `surface/api.attack.surface.analyzer.ts` | Analyses exposed API attack surface |
| `surface/index.ts` | Re-exports surface analyzer |
| `scoring/threat.score.calculator.ts` | Calculates composite threat score |
| `scoring/index.ts` | Re-exports threat scorer |
| `index.ts` | Public surface: `analyze`, CSRF, XSS, all types |

**Call Graph:** `analyze()` → `STRIDE detectors + injection detector + XSS orchestrator + CSRF orchestrator + auth analyzer + config detector + surface analyzer` → `threat.score.calculator`

---

## 6. `intelligence/` — Higher-Order Cognitive Layer

### `consistency/`
Validates consistency across multiple analysis outputs — detects conflicting signals.

| File | Role |
|------|------|
| `consistency.orchestrator.ts` | Entry: `runConsistencyEngine()` |
| `types.ts` | ConsistencyInput, ConsistencyOutput, Conflict, ValidationResult |
| `state.ts` | State management helpers |
| `agents/conflict.detector.agent.ts` | Detects conflicting outputs across analysers |
| `agents/validation.engine.agent.ts` | Validates outputs for internal consistency |
| `agents/truth.selector.agent.ts` | Selects authoritative truth when signals conflict |
| `agents/index.ts` | Re-exports all consistency agents |
| `utils/compare.util.ts` | Deep equality, score comparison utilities |
| `utils/index.ts` | Re-exports utils |
| `index.ts` | Public surface |

---

### `context/`
Builds a unified project context map from analysis results.

| File | Role |
|------|------|
| `context.orchestrator.ts` | Entry: `buildContext()` |
| `types.ts` | ContextInput, ContextMap, ProjectContext types |
| `state.ts` | Context state management |
| `agents/domain-context.agent.ts` | Extracts domain/business context from code |
| `agents/environment-context.agent.ts` | Extracts environment context (prod/staging/dev) |
| `agents/framework-context.agent.ts` | Extracts framework-specific context |
| `agents/project-classifier.agent.ts` | Classifies the overall project type |
| `agents/index.ts` | Re-exports all context agents |
| `utils/context-map.util.ts` | Builds and merges context maps |
| `utils/normalization.util.ts` | Normalises heterogeneous context inputs |
| `utils/index.ts` | Re-exports utils |
| `index.ts` | Public surface |

---

### `quality/`
Produces an overall backend quality score across multiple dimensions.

| File | Role |
|------|------|
| `quality.orchestrator.ts` | Entry: `scoreQuality()` |
| `types.ts` | QualityInput, QualityScore, QualityGrade types |
| `state.ts` | Quality scoring state |
| `agents/dimension.scorer.agent.ts` | Scores individual quality dimensions (security, perf, arch, etc.) |
| `agents/grade.classifier.agent.ts` | Converts numeric score to A/B/C/D/F grade |
| `agents/score.aggregator.agent.ts` | Aggregates dimension scores into composite score |
| `agents/weight.manager.agent.ts` | Manages dimension weights for scoring |
| `agents/index.ts` | Re-exports all quality agents |
| `utils/clamp.util.ts` | Clamps scores to valid range |
| `utils/normalize.util.ts` | Normalises score inputs |
| `utils/weight.util.ts` | Weight calculation utilities |
| `utils/index.ts` | Re-exports utils |
| `index.ts` | Public surface |

---

### `recommendation/`
Generates actionable fix recommendations ordered by priority.

| File | Role |
|------|------|
| `recommendation.orchestrator.ts` | Entry: `generateRecommendations()` |
| `types.ts` | RecommendationInput, Recommendation, ActionPlan types |
| `state.ts` | Recommendation session state |
| `agents/action.generator.agent.ts` | Generates specific action steps for each issue |
| `agents/explanation.builder.agent.ts` | Builds human-readable explanations |
| `agents/fix-recommendation.agent.ts` | Suggests concrete code fixes |
| `agents/improvement.suggester.agent.ts` | Suggests broader architectural improvements |
| `agents/index.ts` | Re-exports all recommendation agents |
| `utils/dedupe.util.ts` | Deduplicates overlapping recommendations |
| `utils/format.util.ts` | Formats recommendation output |
| `utils/grouping.util.ts` | Groups recommendations by category |
| `utils/index.ts` | Re-exports utils |
| `index.ts` | Public surface |

---

### `report/`
Assembles the final intelligence report from all analysis, quality, and recommendation outputs.

| File | Role |
|------|------|
| `report.orchestrator.ts` | Entry: `buildReport()` — final stage in the pipeline |
| `types.ts` | ReportInput, IntelligenceReport, ReportSection types |
| `state.ts` | Report assembly state |
| `agents/action.plan.agent.ts` | Compiles action plans into report sections |
| `agents/formatter.agent.ts` | Formats the final report (markdown/JSON) |
| `agents/issue.grouping.agent.ts` | Groups issues by category in the report |
| `agents/section.generator.agent.ts` | Generates each report section |
| `agents/summary.builder.agent.ts` | Builds the executive summary |
| `agents/index.ts` | Re-exports all report agents |
| `utils/merge.util.ts` | Merges partial report sections |
| `utils/normalize.util.ts` | Normalises section data |
| `utils/sort.util.ts` | Sorts report items by severity/priority |
| `utils/index.ts` | Re-exports utils |
| `index.ts` | Public surface |

---

## Entry Point

| File | Role |
|------|------|
| `index.ts` | Root entry — re-exports `analysis/*`, `backend-code-generator/*`, `backend-deployment-gate/*`, `decision/*`, `security/*`, `intelligence/*` |

---

## Design Principles

- **High Cohesion:** Every module has exactly one responsibility. `api-scanner` only scans APIs. `recommendation` only generates recommendations.
- **Low Coupling:** Modules communicate only through their `index.ts` public surface. Internal files (`core/`, `agents/`, `utils/`) are never imported across module boundaries.
- **Immutable State:** All modules use a `state.ts` pattern with pure transformation functions (`createEmptyState`, `withX`, `toOutput`).
- **Typed Inputs/Outputs:** Every public function is fully typed. No `any`. Types live in `types.ts` or `types/` directories.
- **Validators at the Edge:** Input validation always happens at the orchestrator level before reaching core logic.
- **Index as Contract:** Each module's `index.ts` is its public contract — only what's exported from there may be used by other modules.

---

## Iterative Refinement (Conversational)

**Directory:** `refinement/`
**Purpose:** Multi-turn conversational engine that progressively extracts and refines backend requirements from natural-language user messages. Each turn produces a diff against accumulated state, generates clarifying questions, and tracks convergence toward a fully-specified system.

### Sub-modules

| File | Responsibility |
|------|---------------|
| `types/refinement.types.ts` | All types: `RefinementSession`, `ConversationTurn`, `TrackedRequirement`, `RequirementDelta`, `ClarificationQuestion`, `ConvergenceState`, etc. |
| `session/refinement.session.ts` | In-memory session store. CRUD for `RefinementSession` objects. Supports `createSession`, `getSession`, `updateSession`, `deleteSession`, `listSessionIds`. |
| `diff/refinement.diff.ts` | Delta engine. Compares incoming `NLPParseResult` against `CumulativeParseState` and emits `RequirementDelta[]` (added / removed / modified / confirmed / unchanged). Also detects explicit retractions via negative language. |
| `merger/refinement.merger.ts` | Merge logic. Combines successive `NLPParseResult` objects into a single `CumulativeParseState`. Handles entity field deduplication, feature deduplication, intent resolution (higher-specificity wins), and domain resolution. |
| `clarification/refinement.clarifier.ts` | Question generator. Analyses `CumulativeParseState` + `TrackedRequirement[]` to produce up to 3 prioritised `ClarificationQuestion` objects covering intent, domain, auth, payment provider, architecture, scale, and real-time needs. |
| `convergence/refinement.convergence.ts` | Convergence scorer. Computes a weighted 0–1 score across 5 dimensions (intent, domain, entities, features, confidence). Returns `ConvergenceState` with score, blocker list, per-dimension completeness, and `isConverged` flag (threshold: 0.78). |
| `refinement.engine.ts` | Main orchestrator. Exposes `startSession()`, `getOrCreateSession()`, `getExistingSession()`, `processRefinementTurn()`. Coordinates NLP parse → diff → merge → clarify → converge → reasoning-context update on every turn. |
| `index.ts` | Public surface. Re-exports all types and functions. |

### Data Flow (per turn)

```
User message
    │
    ▼
parseNaturalLanguage()           ← NLP orchestrator
    │
    ▼
diffParseResult()                ← compare against CumulativeParseState
    │                               emit RequirementDelta[]
    ▼
mergeParsedTurn()                ← merge into CumulativeParseState
    │
    ▼
generateClarifications()         ← produce ClarificationQuestion[]
    │
    ▼
computeConvergence()             ← 0-1 convergence score
    │
    ▼
buildReasoningContext()          ← dynamic-reasoning context
    │
    ▼
runInference()                   ← apply inference rules
    │
    ▼
ConversationTurn (user + assistant) appended to session history
    │
    ▼
RefinementTurnOutput { session, deltas, questions, summary, convergence, isComplete }
```

### Public API

```typescript
import {
  startSession,
  processRefinementTurn,
  getExistingSession,
} from "./refinement/index.js";

// 1. Create a session
const session = startSession({ initialMessage: "Build an e-commerce backend with Stripe payments" });

// 2. Process each user turn
const turn = await processRefinementTurn({
  sessionId: session.id,
  message:   "I need user accounts with JWT auth and an admin role",
});

// 3. Read results
console.log(turn.summary);         // natural-language summary
console.log(turn.questions);       // clarifying questions to ask user
console.log(turn.convergence);     // { score: 0.72, isConverged: false, blockers: [...] }
console.log(turn.isComplete);      // true when convergence >= 0.78 with no blockers
```

---

## Stats

| Metric | Count |
|--------|-------|
| TypeScript files | 520 |
| Modules (top-level) | 7 |
| Sub-modules | 33 |
| Template files (code generation) | 48 |
| Test files | 9 |
| Completeness | ~99% |
