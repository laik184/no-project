/**
 * server/orchestration/registry/agent-orchestrators.ts
 *
 * Agent-layer orchestrator entries for the Master Registry.
 * These are platform-services entries — NOT for worker dispatch.
 *
 * Exposes: RuntimeAgent, ReviewAgent, CoordinationAgent,
 *          BuilderAgent, BrowserAgent.
 */

import { wrap }                from './registry-helpers.ts';
import type { OrchestratorEntry } from './registry-helpers.ts';

export const agentOrchestrators: OrchestratorEntry[] = [

  wrap(
    'agent:runtime',
    'platform-services',
    ['runtime-agent', 'runtime-observe', 'process-monitoring', 'health-analysis', 'port-probe'],
    'RuntimeAgent — runtime observation, process monitoring, health analysis, and port probing',
    async () => {
      const { runtimeBridge } = await import('../agents/runtime-bridge.ts');
      return (i: any) => runtimeBridge.observe(i);
    },
  ),

  wrap(
    'agent:review',
    'platform-services',
    ['review-agent', 'code-review', 'policy-validation', 'architecture-review', 'security-review'],
    'ReviewAgent — code quality, architecture validation, policy enforcement, security scanning',
    async () => {
      const { reviewBridge } = await import('../agents/review-bridge.ts');
      return (i: any) => reviewBridge.review(i);
    },
  ),

  wrap(
    'agent:coordination',
    'platform-services',
    ['coordination-agent', 'execution-gate', 'dependency-tracking', 'agent-sync', 'execution-lock'],
    'CoordinationAgent — inter-agent synchronization, dependency-aware gating, execution locks',
    async () => {
      const { coordinationBridge } = await import('../agents/coordination-bridge.ts');
      return (i: any) => {
        if (i?.action === 'init')     return coordinationBridge.init(i);
        if (i?.action === 'gate')     return coordinationBridge.gate(i);
        if (i?.action === 'sync')     return coordinationBridge.sync(i);
        if (i?.action === 'state')    return coordinationBridge.getState(i.runId);
        if (i?.action === 'finalize') return coordinationBridge.finalize(i.runId, i.projectId);
        return coordinationBridge.getState(i?.runId ?? '');
      };
    },
  ),

  wrap(
    'agent:builder',
    'platform-services',
    ['builder-agent', 'code-generation', 'parallel-build', 'scaffold', 'build-coordinator'],
    'BuilderAgent — top-level parallel code generation coordinator with DAG wave execution',
    async () => {
      const { runBuilder } = await import('../../agents/builder/index.ts');
      return (i: any) => runBuilder(i);
    },
  ),

  wrap(
    'agent:browser',
    'platform-services',
    ['browser-agent', 'browser-validation', 'hydration-detection', 'preview-validation', 'screenshot'],
    'BrowserAgent — preview validation, hydration detection, browser runtime observation',
    async () => {
      const { browserBridge } = await import('../agents/browser-bridge.ts');
      return (i: any) => browserBridge.validate(i);
    },
  ),
];
