import type { AgentResult, FrameworkRuntimeInput, LifecycleData, LifecycleFinding } from '../types';
import { groupByFramework, matchNodesByLabelPatterns } from '../utils/pattern-match.util';

export const analyzeLifecycleDetectorAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<LifecycleData> => {
  const grouped = groupByFramework(input.nodes);

  const findings: LifecycleFinding[] = [];

  const reactHooks = matchNodesByLabelPatterns(grouped.react, [/useEffect/i, /useLayoutEffect/i, /useMemo/i]);
  if (reactHooks.length > 0) {
    findings.push({ framework: 'react', lifecycle: 'react-hooks', nodeIds: reactHooks });
  }

  const expressLifecycle = matchNodesByLabelPatterns(grouped.express, [/request/i, /response/i, /next\(/i]);
  if (expressLifecycle.length > 0) {
    findings.push({ framework: 'express', lifecycle: 'request-lifecycle', nodeIds: expressLifecycle });
  }

  const nestLifecycle = matchNodesByLabelPatterns(grouped.nestjs, [
    /onModuleInit/i,
    /onApplicationBootstrap/i,
    /injectable/i,
  ]);
  if (nestLifecycle.length > 0) {
    findings.push({ framework: 'nestjs', lifecycle: 'nest-di-lifecycle', nodeIds: nestLifecycle });
  }

  return {
    logs: [`lifecycle-detector: detected ${findings.length} lifecycle pattern groups`],
    data: { patterns: findings },
  };
};
