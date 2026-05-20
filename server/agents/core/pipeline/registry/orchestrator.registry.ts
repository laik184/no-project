/**
 * server/agents/core/pipeline/registry/orchestrator.registry.ts
 *
 * WORKER + PHASE + PLATFORM REGISTRY — pipeline sub-registry.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  MASTER AUTHORITY: server/orchestration/registry/               ║
 * ║                                                                  ║
 * ║  This file is a SUB-REGISTRY used by the pipeline dispatcher.   ║
 * ║  The canonical master registry that owns ALL orchestrators is:  ║
 * ║    server/orchestration/registry/master-registry.ts             ║
 * ║    server/orchestration/registry/orchestrator-hub.ts            ║
 * ║                                                                  ║
 * ║  Use `orchestratorHub` from server/orchestration/ for:          ║
 * ║    • Listing all registered orchestrators                       ║
 * ║    • Invoking any orchestrator by ID                            ║
 * ║    • Status/health checks across all subsystems                 ║
 * ║    • REST API: GET /api/orchestration/hub/registry              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * This file's exports (ORCHESTRATOR_REGISTRY, PHASE_ORCHESTRATOR_REGISTRY,
 * PLATFORM_SERVICES_REGISTRY) are imported by master-registry.ts and the
 * internal pipeline dispatcher (dispatcher.ts). Do not modify the export
 * names — master-registry.ts depends on them.
 */

export type OrchestratorDomain =
  | 'generation'
  | 'intelligence'
  | 'security'
  | 'observability'
  | 'devops'
  | 'infrastructure'
  | 'core-support'
  | 'data'
  | 'realtime'
  | 'platform-services';

export interface OrchestratorEntry {
  readonly id: string;
  readonly domain: OrchestratorDomain;
  readonly capabilities: readonly string[];
  readonly description: string;
  readonly run: (input: unknown) => Promise<unknown>;
}

type Loader = () => Promise<(input: any) => any>;

function wrap(id: string, domain: OrchestratorDomain, caps: string[], desc: string, loader: Loader): OrchestratorEntry {
  return {
    id, domain,
    capabilities: Object.freeze(caps),
    description: desc,
    run: async (input: unknown) => {
      const fn = await loader();
      return fn(input);
    },
  };
}

// ─── GENERATION — Backend (10) ────────────────────────────────────────────────
const generationBackend: OrchestratorEntry[] = [
  wrap('backend-gen:auth', 'generation', ['auth', 'authentication', 'jwt', 'login', 'oauth'],
    'Generates full auth module with JWT/OAuth',
    async () => { const m = await import('../../../generation/backend-gen/auth-generator/orchestrator.ts'); return (i: any) => m.generateAuthModule(i); }),

  wrap('backend-gen:controller', 'generation', ['controller', 'handler', 'endpoint', 'crud'],
    'Generates REST controllers',
    async () => { const m = await import('../../../generation/backend-gen/controller-generator/orchestrator.ts'); return (i: any) => m.generateController(i); }),

  wrap('backend-gen:model', 'generation', ['model', 'schema', 'entity', 'database-model'],
    'Generates data models',
    async () => { const m = await import('../../../generation/backend-gen/model-generator/orchestrator.ts'); return (i: any) => m.generateModel(i?.input ?? i, i?.orm ?? 'drizzle'); }),

  wrap('backend-gen:service', 'generation', ['service', 'business-logic', 'use-case'],
    'Generates service layer',
    async () => { const m = await import('../../../generation/backend-gen/service-generator/orchestrator.ts'); return (i: any) => m.generateService(i); }),

  wrap('backend-gen:route', 'generation', ['route', 'api', 'rest', 'endpoint', 'path'],
    'Generates API routes',
    async () => { const m = await import('../../../generation/backend-gen/route-generator/orchestrator.ts'); return (i: any) => m.generateRoutes(i); }),

  wrap('backend-gen:middleware', 'generation', ['middleware', 'interceptor', 'guard', 'pipe'],
    'Generates Express middleware',
    async () => { const m = await import('../../../generation/backend-gen/middleware-generator/orchestrator.ts'); return (i: any) => m.generateMiddleware(i); }),

  wrap('backend-gen:migration', 'generation', ['migration', 'db-migration', 'alter-table', 'schema-change'],
    'Generates database migrations',
    async () => { const m = await import('../../../generation/backend-gen/migration-generator/orchestrator.ts'); return (i: any) => m.generateMigration(i); }),

  wrap('backend-gen:env', 'generation', ['env', 'environment', 'config', 'dotenv'],
    'Generates .env config setup',
    async () => { const m = await import('../../../generation/backend-gen/env-configurator/orchestrator.ts'); return (i: any) => m.setupEnv(i); }),

  wrap('backend-gen:api-doc', 'generation', ['api-doc', 'swagger', 'openapi', 'documentation'],
    'Generates API documentation',
    async () => { const m = await import('../../../generation/backend-gen/api-doc-generator/orchestrator.ts'); return (i: any) => m.generateApiDocs(i); }),

  wrap('backend-gen:test', 'generation', ['test', 'unit-test', 'integration-test', 'spec', 'backend-test'],
    'Generates backend tests',
    async () => { const m = await import('../../../generation/backend-gen/test-generator/orchestrator.ts'); return (i: any) => m.generateBackendTests(i); }),
];

// ─── GENERATION — Frontend (7) ────────────────────────────────────────────────
const generationFrontend: OrchestratorEntry[] = [
  wrap('frontend-gen:component', 'generation', ['component', 'ui', 'react', 'vue', 'widget'],
    'Generates frontend components',
    async () => { const m = await import('../../../generation/frontend-gen/component-generator/orchestrator.ts'); return (i: any) => m.generateComponent(i); }),

  wrap('frontend-gen:page', 'generation', ['page', 'view', 'screen', 'layout'],
    'Generates full pages',
    async () => { const m = await import('../../../generation/frontend-gen/page-generator/orchestrator.ts'); return (i: any) => m.runPageGeneration(i); }),

  wrap('frontend-gen:form', 'generation', ['form', 'input', 'validation-form', 'submit'],
    'Generates form components',
    async () => { const m = await import('../../../generation/frontend-gen/form-generator/orchestrator.ts'); return (i: any) => m.generateForm(i); }),

  wrap('frontend-gen:style', 'generation', ['style', 'css', 'tailwind', 'theme', 'design'],
    'Generates styles and themes',
    async () => { const m = await import('../../../generation/frontend-gen/style-generator/orchestrator.ts'); return (i: any) => m.generateResponsiveStyleSystem(i); }),

  wrap('frontend-gen:state', 'generation', ['state', 'redux', 'zustand', 'store', 'context'],
    'Generates state management',
    async () => { const m = await import('../../../generation/frontend-gen/state-management-generator/orchestrator.ts'); return (i: any) => m.generateStateManagement(i); }),

  wrap('frontend-gen:api-client', 'generation', ['api-client', 'fetch', 'axios', 'http-client'],
    'Generates API client layer',
    async () => { const m = await import('../../../generation/frontend-gen/api-client/orchestrator.ts'); return (i: any) => m.generateApiClient(i); }),

  wrap('frontend-gen:test', 'generation', ['frontend-test', 'jest', 'vitest', 'cypress', 'e2e'],
    'Generates frontend tests',
    async () => { const m = await import('../../../generation/frontend-gen/test-generator/orchestrator.ts'); return (i: any) => m.generateFrontendTest(i); }),
];

// ─── GENERATION — Mobile (11) ─────────────────────────────────────────────────
const generationMobile: OrchestratorEntry[] = [
  wrap('mobile:rn-component', 'generation', ['react-native', 'mobile', 'rn-component'],
    'Generates React Native components',
    async () => { const m = await import('../../../generation/mobile/rn-core/component-generator/orchestrator.ts'); return (i: any) => m.generateReactNativeComponent(i); }),

  wrap('mobile:rn-navigation', 'generation', ['navigation', 'react-navigation', 'stack', 'tab'],
    'Generates RN navigation',
    async () => { const m = await import('../../../generation/mobile/rn-core/navigation-generator/orchestrator.ts'); return (i: any) => m.runNavigationGenerator(i); }),

  wrap('mobile:rn-storage', 'generation', ['async-storage', 'mobile-storage', 'rn-storage'],
    'Generates RN storage layer',
    async () => { const m = await import('../../../generation/mobile/rn-core/storage-agent/orchestrator.ts'); return (i: any) => m.runStorageOrchestrator(i); }),

  wrap('mobile:rn-camera', 'generation', ['camera', 'photo', 'barcode', 'scanner'],
    'Generates RN camera feature',
    async () => { const m = await import('../../../generation/mobile/rn-core/camera-agent/orchestrator.ts'); return (i: any) => m.runCameraAgent(i); }),

  wrap('mobile:rn-geo', 'generation', ['geolocation', 'gps', 'location', 'maps'],
    'Generates RN geolocation feature',
    async () => { const m = await import('../../../generation/mobile/rn-core/geolocation-agent/orchestrator.ts'); return (i: any) => m.getCurrentLocation(i); }),

  wrap('mobile:rn-biometric', 'generation', ['biometric', 'fingerprint', 'face-id', 'touch-id'],
    'Generates RN biometric auth',
    async () => { const m = await import('../../../generation/mobile/rn-core/biometric-auth-agent/orchestrator.ts'); return (i: any) => m.runBiometricAuthOrchestrator(i); }),

  wrap('mobile:android-nav', 'generation', ['android-nav', 'android-navigation', 'jetpack-nav'],
    'Generates Android Jetpack navigation',
    async () => { const m = await import('../../../generation/mobile/android/navigation/orchestrator.ts'); return (i: any) => m.buildNavigation(i); }),

  wrap('mobile:android-networking', 'generation', ['retrofit', 'android-networking', 'kotlin-http'],
    'Generates Android Retrofit networking',
    async () => { const m = await import('../../../generation/mobile/android/networking/kotlin-retrofit/orchestrator.ts'); return (i: any) => m.createRetrofitClient(i?.config ?? i, i?.endpoints ?? []); }),

  wrap('mobile:android-viewmodel', 'generation', ['viewmodel', 'android-viewmodel', 'livedata', 'kotlin'],
    'Generates Android ViewModel',
    async () => { const m = await import('../../../generation/mobile/android/viewmodel/kotlin-viewmodel-generator/orchestrator.ts'); return (i: any) => m.generateViewModel(i); }),

  wrap('mobile:ios-networking', 'generation', ['ios-networking', 'urlsession', 'swift-http'],
    'Generates iOS networking layer',
    async () => { const m = await import('../../../generation/mobile/ios-native/networking/orchestrator.ts'); return (i: any) => m.generateNetworkingLayer(i); }),

  wrap('mobile:ios-swiftui', 'generation', ['swiftui', 'ios-ui', 'swift-view'],
    'Generates SwiftUI views',
    async () => { const m = await import('../../../generation/mobile/ios-native/ui/swiftui-view-generator/orchestrator.ts'); return (i: any) => m.generateSwiftUIView(i); }),
];

// ─── GENERATION — Database, GraphQL, PWA, Code, Routing (13) ─────────────────
const generationOther: OrchestratorEntry[] = [
  wrap('db:prisma', 'generation', ['prisma', 'prisma-schema', 'postgres', 'orm'],
    'Generates Prisma schema',
    async () => { const m = await import('../../../generation/database/prisma-schema-generator/orchestrator.ts'); return (i: any) => m.generateSchemaOrchestrator(i); }),

  wrap('db:mongoose', 'generation', ['mongoose', 'mongodb', 'nosql', 'document'],
    'Generates Mongoose schema',
    async () => { const m = await import('../../../generation/database/mongoose-schema-generator/orchestrator.ts'); return (i: any) => m.generateSchemaOrchestrator(i); }),

  wrap('graphql:schema', 'generation', ['graphql', 'gql-schema', 'type-defs'],
    'Generates GraphQL schema',
    async () => { const m = await import('../../../generation/graphql/schema-generator/orchestrator.ts'); return (i: any) => m.generateSchema(i); }),

  wrap('graphql:resolver', 'generation', ['resolver', 'graphql-resolver', 'query', 'mutation'],
    'Generates GraphQL resolvers',
    async () => { const m = await import('../../../generation/graphql/resolver-generator/orchestrator.ts'); return (i: any) => m.generateResolvers(i); }),

  wrap('pwa:service-worker', 'generation', ['pwa', 'service-worker', 'offline', 'progressive-web'],
    'Generates PWA service worker',
    async () => { const m = await import('../../../generation/pwa-gen/service-worker-generator/orchestrator.ts'); return (i: any) => m.runServiceWorker(i); }),

  wrap('pwa:manifest', 'generation', ['manifest', 'web-manifest', 'pwa-manifest'],
    'Generates PWA manifest',
    async () => { const m = await import('../../../generation/pwa-gen/manifest-generator/orchestrator.ts'); return (i: any) => m.generateManifest(i); }),

  wrap('pwa:app-shell', 'generation', ['app-shell', 'pwa-shell', 'shell-architecture'],
    'Generates PWA app shell',
    async () => { const m = await import('../../../generation/pwa-gen/app-shell-generator/orchestrator.ts'); return (i: any) => m.appShellGeneratorOrchestrator(i); }),

  wrap('pwa:offline', 'generation', ['offline-strategy', 'cache-strategy', 'workbox'],
    'Generates offline caching strategy',
    async () => { const m = await import('../../../generation/pwa-gen/offline-strategy/orchestrator.ts'); return (i: any) => m.executeOfflineStrategy(i); }),

  wrap('pwa:push-notification', 'generation', ['push-notification', 'web-push', 'notification'],
    'Generates web push notifications',
    async () => { const m = await import('../../../generation/pwa-gen/push-notification-web/orchestrator.ts'); return (i: any) => m.runPushNotificationModule(i); }),

  wrap('pwa:install-prompt', 'generation', ['install-prompt', 'pwa-install', 'add-to-home'],
    'Generates PWA install prompt',
    async () => { const m = await import('../../../generation/pwa-gen/install-prompt/orchestrator.ts'); return (i: any) => m.runInstallPromptOrchestrator(i); }),

  wrap('code-gen:general', 'generation', ['code-generation', 'generate-code', 'scaffold'],
    'General code generator',
    async () => { const m = await import('../../../generation/code-gen/orchestrator.ts'); const inst = new m.CodeGenOrchestrator(); return (i: any) => inst.generate(i); }),

  wrap('code-gen:file-writer', 'generation', ['write-file', 'file-output', 'save-code'],
    'Writes generated code to files',
    async () => { const m = await import('../../../generation/code-gen/file-writer/orchestrator.ts'); return (i: any) => m.executeFileOperation(i); }),

  wrap('generation:routing', 'generation', ['routing', 'router', 'path-mapping'],
    'Generates routing configuration',
    async () => { const m = await import('../../../generation/routing-generator/orchestrator.ts'); const inst = new m.RoutingGeneratorOrchestrator(); return (i: any) => inst.generate(i); }),
];

// ─── INTELLIGENCE (19 standalone) ────────────────────────────────────────────
const intelligence: OrchestratorEntry[] = [
  wrap('intel:meta-reasoning', 'intelligence', ['meta-reasoning', 'self-check', 'think', 'reasoning'],
    'Verifies AI reasoning quality',
    async () => { const m = await import('../../../intelligence/meta-reasoning/orchestrator.ts'); return (i: any) => m.runMetaReasoning(i); }),

  wrap('intel:capability-discovery', 'intelligence', ['capability', 'agent-discovery', 'what-can-i-do'],
    'Discovers available agent capabilities',
    async () => { const m = await import('../../../intelligence/capability-intelligence/discovery/orchestrator.ts'); return (i: any) => m.runDiscovery(i); }),

  wrap('intel:capability-agent', 'intelligence', ['agent-capability', 'capability-check'],
    'Checks agent capability match',
    async () => { const m = await import('../../../intelligence/capability-intelligence/agent-capability/orchestrator.ts'); return (i: any) => m.buildCapabilityMatrix(i); }),

  wrap('intel:global-observer', 'intelligence', ['observe', 'monitor', 'watch', 'activity'],
    'Observes system activity',
    async () => { const m = await import('../../../intelligence/observation/global-observer/orchestrator.ts'); return (i: any) => m.observe(i); }),

  wrap('intel:self-improvement', 'intelligence', ['self-improve', 'learn', 'adapt', 'optimize-self'],
    'Triggers AI self-improvement cycle',
    async () => { const m = await import('../../../intelligence/self-improvement/orchestrator.ts'); return (i: any) => m.runSelfImprovement(i); }),

  wrap('intel:experimentation', 'intelligence', ['experiment', 'ab-test', 'trial', 'hypothesis'],
    'Runs experimentation analysis',
    async () => { const m = await import('../../../intelligence/experimentation/orchestrator.ts'); return (i: any) => m.runExperiment(i); }),

  wrap('intel:priority', 'intelligence', ['priority', 'rank', 'importance', 'prioritize'],
    'Prioritizes tasks and issues',
    async () => { const m = await import('../../../intelligence/priority/orchestrator.ts'); return (i: any) => m.prioritize(i); }),

  wrap('intel:optimization', 'intelligence', ['optimize', 'performance-tune', 'efficiency'],
    'Optimization intelligence analysis',
    async () => { const m = await import('../../../intelligence/optimization-intelligence/orchestrator.ts'); return (i: any) => m.analyze(i?.runtime ?? i, i?.code ?? i); }),

  wrap('intel:framework-optimizer', 'intelligence', ['framework-optimize', 'framework-choice'],
    'Optimizes framework selection',
    async () => { const m = await import('../../../intelligence/framework-optimizer/orchestrator.ts'); return (i: any) => m.optimizeFramework(i); }),

  wrap('intel:framework-pattern', 'intelligence', ['framework-pattern', 'pattern-match', 'best-practice'],
    'Detects framework patterns',
    async () => { const m = await import('../../../intelligence/framework-pattern-engine/orchestrator.ts'); return (i: any) => m.runFrameworkPatternEngine(i); }),

  wrap('intel:framework-runtime', 'intelligence', ['runtime-analysis', 'framework-runtime'],
    'Analyzes framework runtime behavior',
    async () => { const m = await import('../../../intelligence/framework-runtime-analyzer/orchestrator.ts'); return (i: any) => m.frameworkRuntimeAnalyzerOrchestrator(i); }),

  wrap('intel:frontend-testing', 'intelligence', ['frontend-testing-intel', 'test-strategy'],
    'Frontend testing intelligence',
    async () => { const m = await import('../../../intelligence/frontend-intelligence/testing/orchestrator.ts'); return (i: any) => m.analyzeTesting(i); }),

  wrap('intel:backend-cross', 'intelligence', ['cross-intelligence', 'backend-analysis'],
    'Cross-domain backend intelligence',
    async () => { const m = await import('../../../intelligence/backend-intelligence/cross-intelligence/orchestrator.ts'); const inst = new m.CrossIntelligenceOrchestrator(); return (i: any) => inst.run(i); }),

  wrap('intel:backend-consistency', 'intelligence', ['consistency', 'backend-consistency'],
    'Backend consistency analysis',
    async () => { const m = await import('../../../intelligence/backend-intelligence/intelligence/consistency/orchestrator.ts'); return (i: any) => m.runConsistencyEngine(i); }),

  wrap('intel:backend-context', 'intelligence', ['backend-context', 'context-analysis'],
    'Backend context analysis',
    async () => { const m = await import('../../../intelligence/backend-intelligence/intelligence/context/orchestrator.ts'); return (i: any) => m.buildBackendContext(i); }),

  wrap('intel:backend-quality', 'intelligence', ['code-quality', 'quality-analysis'],
    'Backend code quality analysis',
    async () => { const m = await import('../../../intelligence/backend-intelligence/intelligence/quality/orchestrator.ts'); return (i: any) => m.runQualityEngine(i); }),

  wrap('intel:backend-recommendation', 'intelligence', ['recommendation', 'suggest', 'advice'],
    'Backend recommendations',
    async () => { const m = await import('../../../intelligence/backend-intelligence/intelligence/recommendation/orchestrator.ts'); return (i: any) => m.buildRecommendations(i); }),

  wrap('intel:backend-report', 'intelligence', ['report', 'summary', 'backend-report'],
    'Backend intelligence report',
    async () => { const m = await import('../../../intelligence/backend-intelligence/intelligence/report/orchestrator.ts'); return (i: any) => m.buildBackendIntelligenceReport(i); }),

  wrap('intel:issue-priority', 'intelligence', ['issue-priority', 'bug-priority', 'issue-rank'],
    'Issue prioritization',
    async () => { const m = await import('../../../intelligence/backend-intelligence/issue-prioritizer/priority/orchestrator.ts'); return (i: any) => m.runPriorityEngine(i); }),

  wrap('intel:issue-strategy', 'intelligence', ['fix-strategy', 'resolution-strategy'],
    'Issue resolution strategy',
    async () => { const m = await import('../../../intelligence/backend-intelligence/issue-prioritizer/strategy/orchestrator.ts'); return (i: any) => m.runStrategyEngine(i?.issues ?? i, i?.priorityResult ?? i); }),

  wrap('intel:core-planning', 'intelligence', ['core-plan', 'task-plan'],
    'Core task planning',
    async () => { const m = await import('../../../intelligence/planning/planner/Core-Planning/orchestrator.ts'); return (i: any) => m.createPlan(i); }),

  wrap('intel:intelligence-layer', 'intelligence', ['refine-goal', 'goal-refinement'],
    'Goal refinement layer',
    async () => { const m = await import('../../../intelligence/planning/planner/Intelligence-Layer/orchestrator.ts'); return (i: any) => m.refine(i); }),
];

// ─── INTELLIGENCE — Architecture (14) ────────────────────────────────────────
const architectureIntel: OrchestratorEntry[] = [
  wrap('arch:complexity', 'intelligence', ['complexity-analysis', 'code-complexity', 'cyclomatic'],
    'Code complexity analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/code-quality/complexity-analysis/orchestrator.ts'); return (i: any) => m.analyzeComplexity(i); }),

  wrap('arch:dead-code', 'intelligence', ['dead-code', 'unused-code', 'unreachable'],
    'Dead code analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/code-quality/dead-code-analysis/orchestrator.ts'); return (i: any) => m.analyzeDeadCode(i); }),

  wrap('arch:observability-analysis', 'intelligence', ['observability-analysis', 'telemetry-analysis'],
    'Observability analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/code-quality/observability-analysis/orchestrator.ts'); return (i: any) => m.analyzeObservability(i); }),

  wrap('arch:performance', 'intelligence', ['performance-analysis', 'perf-audit', 'bottleneck'],
    'Performance analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/code-quality/performance-analysis/orchestrator.ts'); return (i: any) => m.analyzePerformance(i); }),

  wrap('arch:api-contract', 'intelligence', ['api-contract', 'contract-analysis', 'api-compatibility'],
    'API contract analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/data-and-api/api-contract-analysis/orchestrator.ts'); return (i: any) => m.analyzeApiContract(i); }),

  wrap('arch:db-schema', 'intelligence', ['schema-analysis', 'database-architecture'],
    'Database schema analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/data-and-api/database-schema-analysis/orchestrator.ts'); return (i: any) => m.analyzeDbSchema(i); }),

  wrap('arch:evolution', 'intelligence', ['evolution', 'migration-plan', 'upgrade-path'],
    'Architecture evolution planning',
    async () => { const m = await import('../../../intelligence/planning/architecture/engine/evolution/orchestrator.ts'); return (i: any) => m.runArchitectureEvolution(i); }),

  wrap('arch:security-analysis', 'intelligence', ['security-analysis', 'vulnerability', 'threat'],
    'Security architecture analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/security/security-analysis/orchestrator.ts'); return (i: any) => m.analyzeSecurity(i); }),

  wrap('arch:boundary', 'intelligence', ['boundary-analysis', 'module-boundary', 'separation'],
    'Module boundary analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/structural/boundary-analysis/orchestrator.ts'); return (i: any) => m.analyzeBoundaries(i); }),

  wrap('arch:dependency', 'intelligence', ['dependency-analysis', 'dep-graph', 'coupling'],
    'Dependency analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/structural/dependency-analysis/orchestrator.ts'); return (i: any) => m.analyzeDependencies(i); }),

  wrap('arch:hvp', 'intelligence', ['hvp-analysis', 'layer-analysis', 'architecture-layers'],
    'HVP layer analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/structural/hvp-analysis/orchestrator.ts'); return (i: any) => m.analyzeHVP(i); }),

  wrap('arch:pattern-detection', 'intelligence', ['pattern-detection', 'design-pattern', 'anti-pattern'],
    'Design pattern detection',
    async () => { const m = await import('../../../intelligence/planning/architecture/structural/pattern-detection/orchestrator.ts'); return (i: any) => m.detectArchitecturePatterns(i); }),

  wrap('arch:responsibility', 'intelligence', ['responsibility', 'srp', 'single-responsibility'],
    'Responsibility analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/structural/responsibility-analysis/orchestrator.ts'); return (i: any) => m.analyzeResponsibility(i); }),

  wrap('arch:test-architecture', 'intelligence', ['test-architecture', 'test-coverage-analysis'],
    'Test architecture analysis',
    async () => { const m = await import('../../../intelligence/planning/architecture/testing/test-architecture-analysis/orchestrator.ts'); return (i: any) => m.analyzeTestArchitecture(i); }),
];

// ─── SECURITY (6) ─────────────────────────────────────────────────────────────
const security: OrchestratorEntry[] = [
  wrap('security:global-safety', 'security', ['safety', 'global-safety', 'content-safety'],
    'Global safety check for all inputs',
    async () => { const m = await import('../../../security/global-safety/orchestrator.ts'); return (i: any) => m.runGlobalSafetyCheck(i); }),

  wrap('security:input-sanitizer', 'security', ['sanitize', 'input-sanitize', 'xss', 'injection'],
    'Sanitizes all inputs',
    async () => { const m = await import('../../../security/input-sanitizer/orchestrator.ts'); return (i: any) => m.sanitizeInputOrchestrator(i); }),

  wrap('security:rate-limiter', 'security', ['rate-limit', 'throttle', 'quota'],
    'Rate limiting',
    async () => { const m = await import('../../../security/rate-limiter/orchestrator.ts'); return (i: any) => m.checkLimitOrchestrator(i); }),

  wrap('security:api-key', 'security', ['api-key', 'key-management', 'token-management'],
    'API key management',
    async () => { const m = await import('../../../security/api-key-manager/orchestrator.ts'); return (i: any) => m.generateApiKeyOrchestrator(i); }),

  wrap('security:oauth2', 'security', ['oauth2', 'oauth', 'sso', 'openid'],
    'OAuth2 provider',
    async () => { const m = await import('../../../security/oauth2-provider/orchestrator.ts'); return (i: any) => m.authorizeOrchestrator(i); }),

  wrap('security:mfa', 'security', ['mfa', '2fa', 'totp', 'multi-factor'],
    'Multi-factor authentication',
    async () => { const m = await import('../../../security/mfa/orchestrator.ts'); return (i: any) => m.verifyMFAOrchestrator(i); }),
];

// ─── OBSERVABILITY (4) ────────────────────────────────────────────────────────
const observability: OrchestratorEntry[] = [
  wrap('obs:health', 'observability', ['health', 'liveness', 'readiness', 'health-check'],
    'Health monitoring',
    async () => { const m = await import('../../../observability/health/orchestrator.ts'); return (i: any) => m.runFullHealthCheck(i); }),

  wrap('obs:logger', 'observability', ['logging', 'logger', 'log-setup'],
    'Logger configuration',
    async () => { const m = await import('../../../observability/logger-setup/orchestrator.ts'); return (i: any) => m.initLoggerOrchestrator(i); }),

  wrap('obs:opentelemetry', 'observability', ['opentelemetry', 'otel', 'tracing', 'spans'],
    'OpenTelemetry tracing',
    async () => { const m = await import('../../../observability/opentelemetry/orchestrator.ts'); return (i: any) => m.runTraceSessionOrchestrator(i); }),

  wrap('obs:prometheus', 'observability', ['prometheus', 'metrics', 'grafana', 'monitoring'],
    'Prometheus metrics',
    async () => { const m = await import('../../../observability/prometheus-metrics/orchestrator.ts'); return (i: any) => m.initMetricsOrchestrator(i); }),
];

// ─── DEVOPS (3) ───────────────────────────────────────────────────────────────
const devops: OrchestratorEntry[] = [
  wrap('devops:docker-compose', 'devops', ['docker-compose', 'compose', 'multi-container'],
    'Docker Compose generation',
    async () => { const m = await import('../../../devops/docker-compose-generator/orchestrator.ts'); return (i: any) => m.generateCompose(i); }),

  wrap('devops:github-actions', 'devops', ['github-actions', 'ci-cd', 'pipeline', 'workflow-yaml'],
    'GitHub Actions CI/CD generation',
    async () => { const m = await import('../../../devops/github-actions-generator/orchestrator.ts'); return (i: any) => m.generateWorkflow(i); }),

  wrap('devops:env-validator', 'devops', ['env-validate', 'environment-check', 'config-validate'],
    'Environment variable validation',
    async () => { const m = await import('../../../devops/env-pipeline-validator/orchestrator.ts'); return (i: any) => m.validateEnv(i); }),
];

// ─── INFRASTRUCTURE (5) ───────────────────────────────────────────────────────
const infrastructure: OrchestratorEntry[] = [
  wrap('infra:deploy', 'infrastructure', ['deploy', 'deployment', 'release', 'ship'],
    'Full deployment orchestration',
    async () => { const m = await import('../../../infrastructure/deploy/orchestrator.ts'); const inst = new m.DeploymentOrchestrator(); return (i: any) => inst.deploy(i); }),

  wrap('infra:docker-config', 'infrastructure', ['dockerfile', 'docker-build', 'container-config'],
    'Docker configuration',
    async () => { const m = await import('../../../infrastructure/deploy/docker-configurator/orchestrator.ts'); return (i: any) => m.generateDockerConfig(i); }),

  wrap('infra:git', 'infrastructure', ['git', 'version-control', 'commit', 'branch', 'merge'],
    'Git operations',
    async () => { const m = await import('../../../infrastructure/git/orchestrator.ts'); return (i: any) => m.runGitAction(i?.action ?? i, i); }),

  wrap('tools:orchestrator', 'infrastructure',
    ['tool-execute', 'run-tool', 'agent-tool', 'tool-call', 'tool-list', 'tool-stats', 'tool-metrics', 'tool-registry'],
    'Centralized ToolOrchestrator — executes, lists, and reports metrics for all 38 agent tools',
    async () => { const m = await import('../../../../tools/orchestrator.ts'); return (i: any) => m.runToolsOperation(i); }),

  // ── Chat Agent Runner ────────────────────────────────────────────────────────
  // Starts a sandboxed tool-loop agent run via the chat run manager.
  // RULE: mode is always 'agent' (tool-loop) here — NEVER 'pipeline'.
  //       Dispatching with mode:'pipeline' would call executePipeline() from
  //       inside Phase 6, triggering the recursion guard and crashing the run.
  wrap('chat:agent-runner', 'infrastructure',
    ['run-agent', 'agent-run', 'start-run', 'execute-agent', 'goal-run', 'agent-goal'],
    'Starts a sandboxed tool-loop agent run (mode=agent) via the ChatOrchestrator run manager. ' +
    'Accepts { goal: string, projectId: number, context?: Record<string,unknown> }. ' +
    'Returns RunHandle { runId, projectId, status, startedAt }.',
    async () => {
      const { runManager } = await import('../../../../chat/run/controller.ts');
      return (i: any) => runManager.runGoal({
        goal:      i?.goal ?? String(i),
        projectId: i?.projectId ?? 0,
        mode:      'agent',   // tool-loop ONLY — never pipeline (prevents recursion)
        context:   i?.context,
      });
    }),
];

// ─── CORE-SUPPORT — LLM (5) ───────────────────────────────────────────────────
const coreLLM: OrchestratorEntry[] = [
  wrap('llm:router', 'core-support', ['llm-route', 'model-select', 'provider-select'],
    'Routes LLM requests to best provider',
    async () => { const m = await import('../../../core/llm/router/orchestrator.ts'); return (i: any) => m.routeLLMRequest(i); }),

  wrap('llm:prompt-builder', 'core-support', ['prompt', 'prompt-build', 'system-prompt'],
    'Builds optimized prompts',
    async () => { const m = await import('../../../core/llm/prompt-builder/orchestrator.ts'); return (i: any) => m.buildPrompt(i); }),

  wrap('llm:context', 'core-support', ['context-compress', 'token-limit', 'context-window'],
    'Compresses context for LLM',
    async () => { const m = await import('../../../core/llm/context/orchestrator.ts'); return (i: any) => m.compressContext(i); }),

  wrap('llm:embeddings', 'core-support', ['embed', 'embedding', 'vector', 'similarity'],
    'Generates embeddings',
    async () => { const m = await import('../../../core/llm/embeddings/orchestrator.ts'); return (i: any) => m.runEmbeddingsOrchestrator(i?.input ?? i, i?.provider ?? 'openai'); }),

  wrap('llm:parser', 'core-support', ['parse-llm', 'llm-response', 'extract-json'],
    'Parses LLM responses',
    async () => { const m = await import('../../../core/llm/parser/llm-response-parser/orchestrator.ts'); return (i: any) => m.parseLLMResponse(i); }),
];

// ─── CORE-SUPPORT — Execution (9) ─────────────────────────────────────────────
const coreExecution: OrchestratorEntry[] = [
  wrap('exec:code-fixer', 'core-support', ['fix-code', 'auto-fix', 'lint-fix'],
    'Automatically fixes code issues',
    async () => { const m = await import('../../../core/execution/code-ops/code-fixer/orchestrator.ts'); return (i: any) => m.runCodeFixer(i); }),

  wrap('exec:diff-proposer', 'core-support', ['diff', 'propose-change', 'code-diff'],
    'Proposes code diffs',
    async () => { const m = await import('../../../core/execution/code-ops/diff-proposer/orchestrator.ts'); return (i: any) => m.proposeDiff(i); }),

  wrap('exec:patch-engine', 'core-support', ['patch', 'apply-patch', 'code-patch'],
    'Applies code patches',
    async () => { const m = await import('../../../core/execution/code-ops/patch-engine/orchestrator.ts'); return (i: any) => m.applyPatch(i); }),

  wrap('exec:migration-runner', 'core-support', ['run-migration', 'migrate-db', 'db-upgrade'],
    'Runs database migrations',
    async () => { const m = await import('../../../core/execution/db-ops/migration-runner/orchestrator.ts'); return (i: any) => m.runMigrations(i); }),

  wrap('exec:debug-agent', 'core-support', ['debug', 'trace-error', 'root-cause'],
    'Debug agent',
    async () => { const m = await import('../../../core/execution/debug-ops/debug-agent/orchestrator.ts'); return (i: any) => m.analyzeError(i); }),

  wrap('exec:error-fixer', 'core-support', ['fix-error', 'resolve-error', 'error-fix'],
    'Fixes runtime errors',
    async () => { const m = await import('../../../core/execution/debug-ops/error-fixer/orchestrator.ts'); return (i: any) => m.analyzeError(i); }),

  wrap('exec:shell', 'core-support', ['shell', 'terminal', 'bash', 'command'],
    'Shell command execution',
    async () => { const m = await import('../../../core/execution/shell/orchestrator.ts'); return (i: any) => m.runCommand(i); }),

  wrap('exec:package-installer', 'core-support', ['install', 'npm-install', 'package-install'],
    'Package installation',
    async () => { const m = await import('../../../core/execution/shell/package-installer/orchestrator.ts'); return (i: any) => m.orchestrateInstall(i); }),

  wrap('exec:test-ops', 'core-support', ['run-tests', 'test-runner', 'jest-run', 'execute-tests'],
    'Runs test suite',
    async () => { const m = await import('../../../core/execution/test-ops/orchestrator.ts'); return (i: any) => m.runTestOrchestration(i); }),
];

// ─── CORE-SUPPORT — Context + Governor (4) ───────────────────────────────────
const coreContext: OrchestratorEntry[] = [
  wrap('context:codebase-indexer', 'core-support', ['index-codebase', 'codebase-index', 'ast-index'],
    'Indexes codebase for context',
    async () => { const m = await import('../../../core/context/indexing/codebase-indexer/orchestrator.ts'); return (i: any) => m.runCodebaseIndexing(i); }),

  wrap('context:context-builder', 'core-support', ['build-context', 'context-build', 'gather-context'],
    'Builds context for LLM',
    async () => { const m = await import('../../../core/context/indexing/context-builder/orchestrator.ts'); return (i: any) => m.buildContext(i); }),

  wrap('context:diff-reviewer', 'core-support', ['review-diff', 'code-review', 'diff-review'],
    'Reviews code diffs',
    async () => { const m = await import('../../../core/context/review/diff-reviewer/orchestrator.ts'); return (i: any) => m.reviewDiff(i); }),

  wrap('core:global-governor', 'core-support', ['govern', 'global-govern', 'system-control'],
    'Global system governor',
    async () => { const m = await import('../../../core/orchestration/global-governor/orchestrator.ts'); return (i: any) => m.govern(i); }),
];

// ─── DATA (2) ─────────────────────────────────────────────────────────────────
const data: OrchestratorEntry[] = [
  wrap('data:redis', 'data', ['redis', 'cache', 'pub-sub', 'key-value'],
    'Redis connection and operations',
    async () => { const m = await import('../../../data/redis/orchestrator.ts'); return (i: any) => m.initRedis(i); }),

  wrap('data:query-optimizer', 'data', ['query-optimize', 'sql-optimize', 'slow-query'],
    'Database query optimization',
    async () => { const m = await import('../../../data/query-optimizer/orchestrator.ts'); return (i: any) => m.optimizeQueries(i); }),
];

// ─── REALTIME (2) ─────────────────────────────────────────────────────────────
const realtime: OrchestratorEntry[] = [
  wrap('realtime:websocket', 'realtime', ['websocket', 'ws', 'socket', 'realtime-server'],
    'WebSocket server generation',
    async () => { const m = await import('../../../realtime/websocket-server-generator/orchestrator.ts'); return (i: any) => m.startWebSocketServerOrchestrator(i); }),

  wrap('realtime:chat', 'realtime', ['chat', 'messaging', 'chatroom', 'real-time-chat'],
    'Real-time chat generation',
    async () => { const m = await import('../../../realtime/chat-feature-generator/orchestrator.ts'); return (i: any) => m.generateChatFeature(i); }),
];

// ─── CORE-PIPELINE — Phase orchestrators (7) ─────────────────────────────────
// INTENTIONALLY NOT in ORCHESTRATOR_REGISTRY (the worker dispatch registry).
// These orchestrators are called DIRECTLY by executePipeline() in its fixed
// 9-phase sequence. Registering them for dispatch would allow Phase 6 to
// re-invoke them mid-pipeline, corrupting shared pipeline state and causing
// recursive execution.
// Exported as PHASE_ORCHESTRATOR_REGISTRY for capability-discovery tooling ONLY.
const corePipeline: OrchestratorEntry[] = [
  wrap('core:router', 'core-support', ['route', 'routing-intent', 'intent-detect', 'domain-route'],
    'Intent detection and domain routing (Phase 2)',
    async () => { const m = await import('../../../core/router/orchestrator.ts'); return (i: any) => m.route(i); }),

  wrap('intel:decision-engine', 'intelligence', ['decide', 'decision', 'strategy-select', 'agent-select'],
    'Strategy selection and agent orchestration (Phase 3)',
    async () => { const m = await import('../../../intelligence/decision-engine/orchestrator.ts'); return (i: any) => m.runDecisionEngine(i); }),

  wrap('intel:planner-boss', 'intelligence', ['plan', 'task-decompose', 'execution-plan', 'planner-boss'],
    'Task decomposition and execution plan (Phase 4)',
    async () => { const m = await import('../../../intelligence/planning/planner/PlannerBoss/orchestrator.ts'); return (i: any) => m.plan(i); }),

  wrap('intel:validation-engine', 'intelligence', ['validate', 'quality-gate', 'validation-engine', 'code-validate'],
    '7-validator quality gate (Phase 5)',
    async () => { const m = await import('../../../intelligence/validation-engine/orchestrator.ts'); return (i: any) => m.validate(i); }),

  wrap('core:recovery', 'core-support', ['recover', 'retry', 'auto-recover', 'failure-recovery'],
    'Automatic retry on failure (Phase 7b)',
    async () => { const m = await import('../../../core/recovery/orchestrator.ts'); return (i: any) => m.recover(i); }),

  wrap('intel:feedback-loop', 'intelligence', ['feedback', 'evaluate-output', 'improve', 'feedback-loop'],
    'Output evaluation and improvement (Phase 8)',
    async () => { const m = await import('../../../intelligence/feedback-loop/orchestrator.ts'); return (i: any) => m.runFeedbackLoop(i); }),

  wrap('core:memory', 'core-support', ['memory', 'remember', 'persist-learning', 'process-memory'],
    'Learning persistence (Phase 9)',
    async () => { const m = await import('../../../core/memory/orchestrator.ts'); return (i: any) => m.processMemory(i); }),
];

// ─── PLATFORM SERVICES (9) ────────────────────────────────────────────────────
// INTENTIONALLY NOT in ORCHESTRATOR_REGISTRY (the worker dispatch registry).
// These wrap orchestration-layer infrastructure: Express routers, SSE/WebSocket
// handlers, the event bus, DB pool, and the LLM HTTP client. They are
// coordination-layer components, not dispatchable worker units.
//
// Architectural violations if dispatched:
//   - platform:http-routes  → Express route handlers (forbidden: route handlers)
//   - platform:streams      → SSE/WebSocket handlers (forbidden: WebSocket managers)
//   - platform:tools        → LLM tool registry (forbidden: tool-loop-runner)
//   - platform:event-bus    → In-process event bus (forbidden: coordination layer)
//   - platform:preview-proxy → HTTP proxy middleware (forbidden: HTTP services)
//   - platform:persistence  → DB pool + ORM (forbidden: coordination layer)
//   - platform:sandbox      → Filesystem scope util (forbidden: coordination layer)
//   - platform:runtime-services → Runtime services (forbidden: orchestration service)
//   - platform:llm-client   → Raw LLM HTTP client (forbidden: coordination layer)
//
// Exported as PLATFORM_SERVICES_REGISTRY for introspection/diagnostics ONLY.
// Also note: several import paths were wrong (server/db, server/events, etc.)
// and are corrected here with the proper infrastructure paths.
const platformServices: OrchestratorEntry[] = [
  wrap('platform:persistence', 'platform-services', ['db', 'postgres', 'drizzle', 'persistence', 'database-pool'],
    'Postgres pool + Drizzle ORM access',
    async () => { const m = await import('../../../infrastructure/db/orchestrator.ts'); return (i: any) => m.runPersistenceOperation(i); }),

  wrap('platform:event-bus', 'platform-services', ['events', 'event-bus', 'pubsub-internal', 'agent-events'],
    'Typed in-process event bus (agent.event, console.log, file.change, run.lifecycle)',
    async () => { const m = await import('../../../infrastructure/events/orchestrator.ts'); return (i: any) => m.runEventBusOperation(i); }),

  wrap('platform:llm-client', 'platform-services', ['llm', 'openrouter', 'completion', 'tool-calling'],
    'OpenRouter LLM HTTP client (chat, streamChat, chatWithTools)',
    async () => { const m = await import('../../../../llm/orchestrator.ts'); return (i: any) => m.runLlmOperation(i); }),

  wrap('platform:preview-proxy', 'platform-services', ['proxy', 'preview-routing', 'http-proxy', 'preview'],
    'Per-project preview proxy with WS upgrade',
    async () => { const m = await import('../../../infrastructure/proxy/orchestrator.ts'); return (i: any) => m.runPreviewProxyOperation(i); }),

  wrap('platform:http-routes', 'platform-services', ['http', 'rest', 'express', 'api-routes'],
    'Aggregates all Express router factories under server/api/*',
    async () => { throw new Error('platform:http-routes is an orchestration-layer component and cannot be dispatched as a worker'); }),

  wrap('platform:sandbox', 'platform-services', ['sandbox', 'path-isolation', 'project-fs'],
    'Per-project filesystem sandbox utilities',
    async () => { const m = await import('../../../infrastructure/sandbox/orchestrator.ts'); return (i: any) => m.runSandboxOperation(i); }),

  wrap('platform:runtime-services', 'platform-services', ['services', 'runtime', 'process', 'fs-service', 'http-service', 'secrets'],
    'Runtime services (filesystem, http, secrets, git, package-manager, project-runner, shell.spawn)',
    async () => { const m = await import('../../../../services/orchestrator.ts'); return (i: any) => m.runRuntimeServicesOperation(i); }),

  wrap('platform:streams', 'platform-services', ['sse', 'streaming', 'live-events'],
    'SSE channels backed by the event bus',
    async () => { throw new Error('platform:streams is an orchestration-layer component and cannot be dispatched as a worker'); }),

  wrap('platform:tools', 'platform-services', ['tool-registry', 'agent-tools', 'tool-defs'],
    'LLM-callable tool registry (file ops, shell, server lifecycle, packages, agent control)',
    async () => { const m = await import('../../../../tools/orchestrator.ts'); return (i: any) => m.runToolsOperation(i); }),

  // ── Chat Orchestrator (platform introspection — NOT for dispatch) ────────────
  // The ChatOrchestrator is an orchestration-layer platform service:
  //   - manages Express chat routes (history, prompts, messages, feedback, upload, stream)
  //   - owns SSE channels + WebSocket server attachment
  //   - manages agent run lifecycle (start, cancel, registry)
  //   - owns the question bus (wait/resolve between agent and user)
  //   - exposes the full 9-phase pipeline (executePipeline) and generator orchestrator
  // It MUST NOT be dispatched as a worker — included here for diagnostics/introspection only.
  wrap('platform:chat-orchestrator', 'platform-services',
    ['chat-orchestrator', 'chat-platform', 'run-manager', 'question-bus', 'chat-routes',
     'sse-manager', 'websocket-manager', 'pipeline-gateway', 'agent-lifecycle'],
    'ChatOrchestrator — platform gateway for chat routes, SSE, WebSocket, run lifecycle, ' +
    'question bus, pipeline execution access, and generator orchestrator. ' +
    'Introspection only — dispatching this entry is FORBIDDEN.',
    async () => {
      const { chatOrchestrator } = await import('../../../../chat/orchestrator.ts');
      return (_i: any) => ({
        pipelineMetrics:   chatOrchestrator.pipeline.getMetrics(),
        registryStats:     chatOrchestrator.pipeline.registry.getStats(),
        activeRuns:        chatOrchestrator.runRegistry.size,
        pendingQuestions:  chatOrchestrator.questions.pendingCount(),
      });
    }),
];

// ─── WORKER DISPATCH REGISTRY ────────────────────────────────────────────────
// Only worker units (generators, builders, analyzers, transformers, executors)
// belong here. Orchestration-layer components (phase orchestrators, platform
// services, route handlers, WebSocket managers) are EXCLUDED.
//
// EXCLUDED groups and why:
//   corePipeline    → Phase orchestrators already called directly by executePipeline().
//                     Including them allows Phase 6 to re-invoke them, corrupting
//                     shared pipeline state and risking recursive execution.
//   platformServices → Orchestration-layer infrastructure (http-routes, streams,
//                     tools, event-bus, preview-proxy) — forbidden by architecture.
export const ORCHESTRATOR_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...generationBackend,
  ...generationFrontend,
  ...generationMobile,
  ...generationOther,
  ...intelligence,
  ...architectureIntel,
  ...security,
  ...observability,
  ...devops,
  ...infrastructure,
  ...coreLLM,
  ...coreExecution,
  ...coreContext,
  ...data,
  ...realtime,
]);

// ─── PHASE ORCHESTRATOR REGISTRY (discovery/tooling only — NOT for dispatch) ──
// Exposes the 7 fixed-phase orchestrators for capability discovery tools and
// tests. Must NEVER be passed to dispatch() or the dispatcher.
export const PHASE_ORCHESTRATOR_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...corePipeline,
]);

// ─── PLATFORM SERVICES REGISTRY (introspection/diagnostics only) ─────────────
// Exposes platform service descriptors for diagnostics and health checks.
// Must NEVER be passed to dispatch() or the dispatcher.
export const PLATFORM_SERVICES_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...platformServices,
]);

// ─── FORBIDDEN DISPATCH IDs ───────────────────────────────────────────────────
// Any ID in this set must never appear in ORCHESTRATOR_REGISTRY.
// Used by assertRegistryIntegrity() and the dispatcher guard.
export const FORBIDDEN_DISPATCH_IDS: ReadonlySet<string> = new Set([
  // Phase orchestrators (called directly by executePipeline — re-dispatching corrupts state)
  'core:router', 'intel:decision-engine', 'intel:planner-boss',
  'intel:validation-engine', 'core:recovery', 'intel:feedback-loop', 'core:memory',
  // Platform services (orchestration-layer infrastructure — forbidden as workers)
  'platform:persistence', 'platform:event-bus', 'platform:llm-client',
  'platform:preview-proxy', 'platform:http-routes', 'platform:sandbox',
  'platform:runtime-services', 'platform:streams', 'platform:tools',
  // Chat orchestrator (platform-services level — contains pipeline, routes, SSE, WS)
  // Dispatching this would create a circular dependency: pipeline → chat → pipeline
  'platform:chat-orchestrator',
]);

// ─── FORBIDDEN DISPATCH DOMAINS ──────────────────────────────────────────────
// Domains that must never be targets of worker dispatch.
export const FORBIDDEN_DISPATCH_DOMAINS: ReadonlySet<OrchestratorDomain> = new Set<OrchestratorDomain>([
  'platform-services',
]);

// ─── REGISTRY INTEGRITY ASSERTION ────────────────────────────────────────────
// Call once at startup (or in tests) to verify no forbidden units slipped in.
export function assertRegistryIntegrity(): void {
  const ids = new Set<string>();
  for (const entry of ORCHESTRATOR_REGISTRY) {
    // Duplicate ID check
    if (ids.has(entry.id)) {
      throw new Error(`[registry] Duplicate entry ID detected: "${entry.id}"`);
    }
    ids.add(entry.id);

    // Forbidden ID check
    if (FORBIDDEN_DISPATCH_IDS.has(entry.id)) {
      throw new Error(
        `[registry] Forbidden entry "${entry.id}" found in ORCHESTRATOR_REGISTRY. ` +
        `Orchestration-layer components must not be registered for dispatch.`,
      );
    }

    // Forbidden domain check
    if (FORBIDDEN_DISPATCH_DOMAINS.has(entry.domain)) {
      throw new Error(
        `[registry] Entry "${entry.id}" has forbidden domain "${entry.domain}". ` +
        `Platform-services components must not be registered for dispatch.`,
      );
    }
  }
}

// Run integrity check at module load time to catch violations immediately.
assertRegistryIntegrity();

export function getRegistryStats() {
  const byDomain: Record<string, number> = {};
  for (const e of ORCHESTRATOR_REGISTRY) {
    byDomain[e.domain] = (byDomain[e.domain] ?? 0) + 1;
  }
  return Object.freeze({ total: ORCHESTRATOR_REGISTRY.length, byDomain });
}

export function findByCapability(capability: string): readonly OrchestratorEntry[] {
  const lower = capability.toLowerCase();
  return Object.freeze(
    ORCHESTRATOR_REGISTRY.filter((e) =>
      e.capabilities.some((c) => c.includes(lower) || lower.includes(c)),
    ),
  );
}

export function findById(id: string): OrchestratorEntry | undefined {
  return ORCHESTRATOR_REGISTRY.find((e) => e.id === id);
}

export function findByDomain(domain: OrchestratorDomain): readonly OrchestratorEntry[] {
  return Object.freeze(ORCHESTRATOR_REGISTRY.filter((e) => e.domain === domain));
}
