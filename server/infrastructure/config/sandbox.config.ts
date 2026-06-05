/**
 * server/infrastructure/config/sandbox.config.ts
 *
 * Single source of truth for the agent sandbox root path.
 * All layers that need the sandbox root MUST import from here.
 * Do NOT read AGENT_PROJECT_ROOT directly anywhere else.
 *
 * Consumers:
 *   - server/shared/file-explorer-core/config/explorer.config.ts
 *   - server/chat/orchestration/chat-orchestrator.ts
 *   - server/tools/filesystem/ (via services/resolveSafe)
 */

import path from 'path';

export const SANDBOX_ROOT: string =
  process.env.AGENT_PROJECT_ROOT ?? path.join(process.cwd(), '.sandbox');
