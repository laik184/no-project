import type { DecisionInput, ClassifiedIntent, ContextAnalysis, Domain, Complexity } from '../types.ts';

const DOMAIN_SIGNALS: Record<Domain, string[]> = {
  backend: ['api', 'server', 'route', 'controller', 'database', 'model', 'express', 'nest', 'rest', 'graphql', 'prisma', 'mongoose'],
  frontend: ['component', 'ui', 'react', 'vue', 'angular', 'page', 'form', 'style', 'css', 'html', 'button', 'layout'],
  mobile: ['ios', 'android', 'swiftui', 'kotlin', 'react native', 'expo', 'mobile', 'navigation', 'screen'],
  devops: ['docker', 'ci', 'cd', 'pipeline', 'github actions', 'compose', 'yaml', 'deploy', 'build'],
  data: ['redis', 'cache', 'query', 'database', 'sql', 'migration', 'schema', 'prisma', 'mongo'],
  security: ['auth', 'authentication', 'oauth', 'mfa', 'jwt', 'token', 'rate limit', 'sanitize', 'permission'],
  realtime: ['websocket', 'socket', 'chat', 'realtime', 'event', 'pub', 'sub', 'stream'],
  infrastructure: ['infra', 'git', 'rollback', 'deploy runner', 'network', 'port', 'nginx'],
  unknown: [],
};

function detectDomain(input: string, context: Record<string, unknown>): Domain {
  const lower = input.toLowerCase();
  const ctxStr = JSON.stringify(context).toLowerCase();
  const combined = `${lower} ${ctxStr}`;

  let best: Domain = 'unknown';
  let bestScore = 0;

  for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS) as [Domain, string[]][]) {
    if (domain === 'unknown') continue;
    const score = signals.filter((s) => combined.includes(s)).length;
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }
  return best;
}

function detectComplexity(input: string, context: Record<string, unknown>): Complexity {
  const lower = input.toLowerCase();
  const wordCount = lower.split(/\s+/).length;
  const hasMultiple = /and|also|plus|with|including|together|multiple/i.test(lower);
  const hasDependency = context['dependencies'] !== undefined;
  const depCount = Array.isArray(context['dependencies']) ? (context['dependencies'] as unknown[]).length : 0;

  if (wordCount > 30 || depCount > 5 || (hasMultiple && depCount > 2)) return 'high';
  if (wordCount > 12 || depCount > 2 || hasMultiple) return 'medium';
  return 'low';
}

function extractDependencies(context: Record<string, unknown>): string[] {
  const deps = context['dependencies'];
  if (Array.isArray(deps)) return deps.map(String);
  if (typeof deps === 'string') return [deps];
  return [];
}

function estimateSteps(complexity: Complexity, intent: ClassifiedIntent['intent']): number {
  const base: Record<typeof intent, number> = {
    generate: 4,
    fix: 3,
    analyze: 3,
    deploy: 5,
    optimize: 4,
  };
  const multiplier: Record<Complexity, number> = { low: 1, medium: 2, high: 3 };
  return base[intent] * multiplier[complexity];
}

function hasSecurityImplication(input: string, domain: Domain): boolean {
  const secKeywords = ['auth', 'token', 'secret', 'password', 'api key', 'permission', 'role', 'admin'];
  const lower = input.toLowerCase();
  return domain === 'security' || secKeywords.some((k) => lower.includes(k));
}

export function analyzeContext(input: DecisionInput, intent: ClassifiedIntent): ContextAnalysis {
  const domain = detectDomain(input.userInput, input.context);
  const complexity = detectComplexity(input.userInput, input.context);
  const dependencies = extractDependencies(input.context);
  const estimatedSteps = estimateSteps(complexity, intent.intent);
  const securityFlag = hasSecurityImplication(input.userInput, domain);

  return Object.freeze({
    domain,
    complexity,
    dependencies,
    estimatedSteps,
    hasSecurityImplication: securityFlag,
  });
}
