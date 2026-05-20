import type { ClassifiedIntent, ContextAnalysis, CapabilityMap, Intent, Domain } from '../types.ts';

const AGENT_CAPABILITY_MAP: Record<Intent, Record<Domain | 'default', string[]>> = {
  generate: {
    backend: ['controller-generator', 'route-generator', 'service-generator', 'model-generator'],
    frontend: ['component-generator', 'page-generator', 'form-generator', 'style-generator'],
    mobile: ['swiftui-view-generator', 'kotlin-viewmodel-generator', 'android-navigation'],
    devops: ['docker-compose-generator', 'github-actions-generator'],
    data: ['prisma-schema-generator', 'mongoose-schema-generator'],
    security: ['auth-generator', 'api-key-manager'],
    realtime: ['websocket-server-generator', 'chat-feature-generator'],
    infrastructure: ['deploy-runner', 'docker-configurator'],
    unknown: ['code-gen'],
    default: ['code-gen'],
  },
  fix: {
    backend: ['error-fixer', 'code-fixer', 'debug-agent'],
    frontend: ['error-fixer', 'code-fixer'],
    mobile: ['error-fixer', 'debug-agent'],
    devops: ['error-fixer', 'env-pipeline-validator'],
    data: ['error-fixer', 'query-optimizer'],
    security: ['error-fixer', 'input-sanitizer'],
    realtime: ['error-fixer', 'debug-agent'],
    infrastructure: ['error-fixer', 'rollback-trigger'],
    unknown: ['error-fixer', 'debug-agent'],
    default: ['error-fixer', 'debug-agent'],
  },
  analyze: {
    backend: ['backend-intelligence', 'quality-orchestrator', 'consistency-orchestrator'],
    frontend: ['frontend-intelligence'],
    mobile: ['framework-runtime-analyzer'],
    devops: ['env-pipeline-validator'],
    data: ['query-optimizer'],
    security: ['orchestrator', 'input-sanitizer'],
    realtime: ['framework-runtime-analyzer'],
    infrastructure: ['framework-pattern-engine'],
    unknown: ['framework-runtime-analyzer', 'framework-pattern-engine'],
    default: ['backend-intelligence'],
  },
  deploy: {
    backend: ['deploy-runner', 'docker-configurator', 'github-actions-generator'],
    frontend: ['deploy-runner', 'docker-configurator'],
    mobile: ['deploy-runner'],
    devops: ['deploy-runner', 'docker-compose-generator', 'github-actions-generator'],
    data: ['migration-runner', 'deploy-runner'],
    security: ['deploy-runner', 'rate-limiter'],
    realtime: ['deploy-runner', 'websocket-server-generator'],
    infrastructure: ['deploy-runner', 'git-agent'],
    unknown: ['deploy-runner'],
    default: ['deploy-runner'],
  },
  optimize: {
    backend: ['framework-optimizer', 'query-optimizer', 'framework-runtime-analyzer'],
    frontend: ['framework-optimizer', 'optimization-intelligence'],
    mobile: ['framework-optimizer'],
    devops: ['framework-optimizer'],
    data: ['query-optimizer', 'redis-agent'],
    security: ['rate-limiter', 'input-sanitizer'],
    realtime: ['framework-optimizer', 'websocket-server-generator'],
    infrastructure: ['framework-optimizer'],
    unknown: ['optimization-intelligence'],
    default: ['optimization-intelligence'],
  },
};

function resolveAgents(intent: Intent, domain: Domain): string[] {
  const intentMap = AGENT_CAPABILITY_MAP[intent];
  return intentMap[domain] ?? intentMap['default'];
}

function intersectWithAvailable(agents: string[], available: string[]): string[] {
  if (available.length === 0) return agents;
  const matched = agents.filter((a) => available.includes(a));
  return matched.length > 0 ? matched : agents;
}

export function mapCapabilities(
  intent: ClassifiedIntent,
  context: ContextAnalysis,
  availableAgents: string[],
): CapabilityMap {
  const primary = resolveAgents(intent.intent, context.domain);
  const supporting = resolveAgents(intent.intent, 'default' as Domain).filter(
    (a) => !primary.includes(a),
  );

  const filteredPrimary = intersectWithAvailable(primary, availableAgents);
  const filteredSupporting = intersectWithAvailable(supporting, availableAgents).filter(
    (a) => !filteredPrimary.includes(a),
  );

  const taskAgentMap: Record<string, string[]> = {
    [intent.intent]: filteredPrimary,
    supporting: filteredSupporting,
  };

  return Object.freeze({
    taskAgentMap,
    primaryAgents: filteredPrimary,
    supportingAgents: filteredSupporting,
    totalCapable: filteredPrimary.length + filteredSupporting.length,
  });
}
