/**
 * server/services/chat/context.service.ts
 *
 * Context building coordination — assembles the LLM prompt context.
 *
 * Owns: build context, load messages, memory context injection,
 *       conversation context, prompt assembly, context loading coordination.
 */

import { buildContext, serializeContext } from '../../chat/context/context-builder.ts';
import { contextLoader }                  from '../../chat/context/context-loader.ts';
import { buildMemoryContextString }       from '../../memory/index.ts';
import type { BuiltContext }              from '../../chat/context/context-builder.ts';
import type { LoadedContext }             from '../../chat/context/context-loader.ts';
import type { ChatMessageRecord }         from '../../chat/types/message.types.ts';

export type { BuiltContext, LoadedContext };

export interface FullContext {
  built:         BuiltContext;
  memoryContext: string;
  runId:         string;
  projectId:     number;
}

export const contextService = {
  /**
   * Load raw message + run data for a run (with cache).
   */
  async loadForRun(runId: string): Promise<LoadedContext> {
    return contextLoader.loadForRun(runId);
  },

  /**
   * Load recent messages for a project (no runId active).
   */
  async loadForProject(projectId: number, limit = 40): Promise<ChatMessageRecord[]> {
    return contextLoader.loadForProject(projectId, limit);
  },

  /**
   * Build LLM context window from messages + optional system prompt.
   */
  build(
    messages:      ChatMessageRecord[],
    systemPrompt?: string,
    maxMessages = 40,
  ): BuiltContext {
    return buildContext(messages, systemPrompt, maxMessages);
  },

  /**
   * Serialize a BuiltContext to a flat string (for logging/debugging).
   */
  serialize(ctx: BuiltContext): string {
    return serializeContext(ctx);
  },

  /**
   * Invalidate cached context for a run (call after new message stored).
   */
  invalidate(runId: string): void {
    contextLoader.invalidate(runId);
  },

  /**
   * Build the complete LLM context for a run in one call:
   * loads messages → applies window → injects memory context.
   */
  async buildForRun(
    runId:         string,
    projectId:     number,
    systemPrompt?: string,
  ): Promise<FullContext> {
    const [loaded, memoryContext] = await Promise.all([
      contextLoader.loadForRun(runId),
      buildMemoryContextString({ runId, projectId } as any).catch(() => ''),
    ]);

    const built = buildContext(loaded.messages, systemPrompt);
    return { built, memoryContext, runId, projectId };
  },
};
