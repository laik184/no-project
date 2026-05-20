import type { ClassifiedIntent, ContextAnalysis, CapabilityMap, StrategySelection, Strategy } from '../types.ts';

function selectStrategy(
  intent: ClassifiedIntent,
  context: ContextAnalysis,
  capability: CapabilityMap,
): Strategy {
  const { complexity } = context;
  const { primaryAgents, totalCapable } = capability;

  if (primaryAgents.length === 1 && complexity === 'low') return 'single-agent';
  if (totalCapable > 3 || complexity === 'high') return 'pipeline';
  return 'multi-agent';
}

function buildAgentSequence(
  strategy: Strategy,
  capability: CapabilityMap,
  context: ContextAnalysis,
): string[] {
  const { primaryAgents, supportingAgents } = capability;

  if (strategy === 'single-agent') return [primaryAgents[0]];

  if (strategy === 'pipeline') {
    const all = [...primaryAgents, ...supportingAgents];
    if (context.hasSecurityImplication) {
      const security = all.filter((a) => a.includes('sanitizer') || a.includes('auth') || a.includes('rate'));
      const rest = all.filter((a) => !security.includes(a));
      return [...security, ...rest];
    }
    return all;
  }

  return [...primaryAgents, ...supportingAgents].slice(0, 3);
}

function buildParallelGroups(strategy: Strategy, sequence: string[]): string[][] {
  if (strategy === 'single-agent') return [[sequence[0]]];
  if (strategy === 'pipeline') return sequence.map((a) => [a]);
  const mid = Math.ceil(sequence.length / 2);
  return [sequence.slice(0, mid), sequence.slice(mid)].filter((g) => g.length > 0);
}

function buildReasoning(strategy: Strategy, intent: ClassifiedIntent, context: ContextAnalysis): string {
  const parts: string[] = [
    `Intent: ${intent.intent} (confidence: ${(intent.confidence * 100).toFixed(0)}%)`,
    `Domain: ${context.domain}`,
    `Complexity: ${context.complexity}`,
    `Strategy chosen: ${strategy}`,
  ];

  if (strategy === 'single-agent') parts.push('Low complexity — single focused agent is sufficient.');
  if (strategy === 'multi-agent') parts.push('Medium scope — parallel agents increase throughput.');
  if (strategy === 'pipeline') parts.push('High complexity or security concern — sequential pipeline ensures correctness.');

  return parts.join(' | ');
}

export function selectStrategy_(
  intent: ClassifiedIntent,
  context: ContextAnalysis,
  capability: CapabilityMap,
): StrategySelection {
  const strategy = selectStrategy(intent, context, capability);
  const agentSequence = buildAgentSequence(strategy, capability, context);
  const parallelGroups = buildParallelGroups(strategy, agentSequence);
  const reasoning = buildReasoning(strategy, intent, context);

  return Object.freeze({
    strategy,
    agentSequence,
    parallelGroups,
    reasoning,
  });
}
