/**
 * server/tools/browser/session/browser-session-tools.ts
 *
 * Tools: browser_launch, browser_close
 *
 * Registers browser session lifecycle as dispatchable tools so that agents
 * can manage sessions entirely via dispatcher-client — never via direct imports.
 * All Playwright state management stays in the tool layer where it belongs.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { launchBrowser, closeBrowser }               from './browser-lifecycle.ts';
import type { BrowserLaunchOptions }                 from '../shared/browser-types.ts';

// ── browser_launch ────────────────────────────────────────────────────────────

export const browserLaunchTool: ToolDefinition = {
  name:        'browser_launch',
  category:    'browser',
  description: 'Launch a Playwright browser session scoped to the given runId.',
  inputSchema: {
    headless:  { type: 'boolean', description: 'Run headless (default true)',     required: false, default: true    },
    timeoutMs: { type: 'number',  description: 'Max session duration in ms',      required: false, default: 30_000  },
    projectId: { type: 'number',  description: 'Numeric project identifier',      required: false },
  },
  permissions: ['network', 'execute'],
  timeoutMs:   TIMEOUT.BROWSER,
  retry:       RETRY_NONE,

  handler: async (input: Record<string, unknown>, ctx: ToolExecutionContext) => {
    const opts: BrowserLaunchOptions = {
      headless:  input.headless  !== false,
      timeoutMs: typeof input.timeoutMs === 'number' ? input.timeoutMs : 30_000,
      projectId: typeof input.projectId === 'number' ? input.projectId : undefined,
    };

    const result = await launchBrowser(ctx.runId, opts);
    if (!result.ok) {
      throw new Error(result.error ?? 'Failed to launch browser session');
    }
    return { sessionId: result.sessionId, runId: result.runId };
  },
};

// ── browser_close ─────────────────────────────────────────────────────────────

export const browserCloseTool: ToolDefinition = {
  name:        'browser_close',
  category:    'browser',
  description: 'Close the active Playwright session for the given runId.',
  inputSchema: {},
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input: Record<string, unknown>, ctx: ToolExecutionContext) => {
    await closeBrowser(ctx.runId);
    return { closed: true, runId: ctx.runId };
  },
};
