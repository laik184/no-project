/**
 * server/orchestration/registry/service-orchestrators.ts
 *
 * Server-level service orchestrator entries for the Master Registry.
 * These are platform-services entries — NOT for worker dispatch.
 *
 * Covers: Console, FileExplorer, Preview, AutonomousDebug,
 *         Deploy, Tools, Git, Chat.
 */

import { wrap }                from './registry-helpers.ts';
import type { OrchestratorEntry } from './registry-helpers.ts';

export const serviceOrchestrators: OrchestratorEntry[] = [

  wrap(
    'service:console',
    'platform-services',
    ['console', 'log-capture', 'stdout', 'stderr', 'console-orchestrator'],
    'ConsoleOrchestrator — wires processRegistry → bus → intelligence parsers → state machine → persist + stream',
    async () => {
      const { consoleOrchestrator } = await import('../../console/console.orchestrator.ts');
      return (i: any) => ({ status: 'console-orchestrator', info: consoleOrchestrator, input: i });
    },
  ),

  wrap(
    'service:file-explorer',
    'platform-services',
    ['file-explorer', 'file-crud', 'directory-tree', 'watcher', 'search-files'],
    'FileExplorerOrchestrator — central coordinator for file CRUD, watcher, search, history',
    async () => {
      const { fileExplorerOrchestrator } = await import('../../file-explorer/file-explorer.orchestrator.ts');
      return (i: any) => ({ status: 'file-explorer-orchestrator', info: fileExplorerOrchestrator, input: i });
    },
  ),

  wrap(
    'service:preview',
    'platform-services',
    ['preview', 'live-preview', 'hot-reload', 'preview-pipeline'],
    'PreviewOrchestrator — central coordinator for all preview subsystems, service lifecycle, health aggregation',
    async () => {
      const { previewOrchestrator } = await import('../../preview/preview.orchestrator.ts');
      return (i: any) => ({ status: 'preview-orchestrator', info: previewOrchestrator, input: i });
    },
  ),

  wrap(
    'service:autonomous-debug',
    'platform-services',
    ['autonomous-debug', 'crash-recovery', 'auto-debug', 'error-crash', 'debug-orchestrator'],
    'AutonomousDebugOrchestrator — crash detection, session build, log extract, correlate, checkpoint',
    async () => {
      const { handleCrash, getOrchestratorState, resetProject } = await import('../../debug/core/debug-orchestrator.ts');
      return (i: any) => {
        if (i?.action === 'reset') return resetProject(i.projectId);
        if (i?.action === 'state') return getOrchestratorState(i.projectId);
        return handleCrash(i);
      };
    },
  ),

  wrap(
    'service:deploy',
    'platform-services',
    ['deploy', 'publish', 'build-deploy', 'deployment-pipeline', 'provision'],
    'DeployOrchestrator — full deployment pipeline: provision → build → bundle → promote',
    async () => {
      const { startDeployment, getDeployment, listDeployments } = await import('../../publishing/services/deployment/deploy-orchestrator.ts');
      return (i: any) => {
        if (i?.action === 'get')  return getDeployment(i.deploymentId);
        if (i?.action === 'list') return listDeployments(i.projectId);
        return startDeployment(i);
      };
    },
  ),

  wrap(
    'service:tools',
    'platform-services',
    ['tool-registry', 'agent-tools', 'tool-defs', 'tools-orchestrator'],
    'ToolOrchestrator — thin adapter over the unified tool registry (file ops, shell, server lifecycle, packages, agent control)',
    async () => {
      const { runToolsOperation } = await import('../../tools/orchestrator.ts');
      return (i: any) => runToolsOperation(i);
    },
  ),

  wrap(
    'service:git',
    'platform-services',
    ['git', 'git-action', 'commit', 'branch', 'merge', 'checkout', 'git-log', 'git-status'],
    'GitOrchestrator — git operations: commit, branch, checkout, merge, log, status',
    async () => {
      const { runGitAction } = await import('../../infrastructure/git/orchestrator.ts');
      return (i: any) => runGitAction(i?.action, i?.payload ?? i);
    },
  ),

  wrap(
    'service:chat',
    'platform-services',
    ['chat-orchestrator', 'chat-platform', 'run-manager', 'question-bus', 'chat-routes', 'pipeline-gateway'],
    'ChatOrchestrator — platform gateway for chat routes, SSE, WebSocket, run lifecycle, pipeline execution',
    async () => {
      const { chatOrchestrator } = await import('../../chat/orchestrator.ts');
      return (_i: any) => ({
        pipelineMetrics:  chatOrchestrator.pipeline.getMetrics(),
        registryStats:    chatOrchestrator.pipeline.registry.getStats(),
        activeRuns:       chatOrchestrator.runRegistry.size,
        pendingQuestions: chatOrchestrator.questions.pendingCount(),
      });
    },
  ),
];
