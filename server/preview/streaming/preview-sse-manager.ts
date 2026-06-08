/**
 * preview-sse-manager.ts — Preview-scoped SSE connection manager.
 * Wraps the infrastructure sseManager for preview-specific operations.
 */

import { sseManager } from "../../infrastructure/index.ts";
import type { Response } from "express";
import { ALL_PREVIEW_TOPICS, PREVIEW_TOPIC } from "./preview-topic-registry.ts";
import type { PreviewTopic }                 from "./preview-topic-registry.ts";

export interface SseSubscribeOptions {
  projectId?: number;
  topics?:    PreviewTopic[];
}

class PreviewSseManager {
  /**
   * Register an SSE response for preview events.
   * Returns a cleanup function to remove the connection.
   */
  register(
    res:  Response,
    opts: SseSubscribeOptions = {},
  ): () => void {
    const topics    = opts.topics ?? ALL_PREVIEW_TOPICS;
    const projectId = opts.projectId != null ? opts.projectId : null;

    return sseManager.register(
      res,
      new Set(topics) as ReadonlySet<string>,
      projectId,
    );
  }

  /**
   * Broadcast a preview event to all connected clients (optionally filtered by project).
   */
  broadcast(
    topic:     PreviewTopic,
    payload:   Record<string, unknown>,
    projectId: number | null = null,
  ): void {
    sseManager.publish(topic, payload, projectId);
  }

  /**
   * Broadcast a lifecycle event.
   */
  broadcastLifecycle(
    projectId: number,
    payload:   Record<string, unknown>,
  ): void {
    this.broadcast(PREVIEW_TOPIC.LIFECYCLE, payload, projectId);
  }

  /**
   * Broadcast a health event.
   */
  broadcastHealth(
    projectId: number,
    payload:   Record<string, unknown>,
  ): void {
    this.broadcast(PREVIEW_TOPIC.HEALTH, payload, projectId);
  }

  /**
   * Broadcast a reload event.
   */
  broadcastReload(
    projectId: number,
    payload:   Record<string, unknown>,
  ): void {
    this.broadcast(PREVIEW_TOPIC.RELOAD, payload, projectId);
  }

  /**
   * Number of active preview SSE connections.
   */
  get connectionCount(): number {
    return sseManager.connectionCount;
  }
}

export const previewSseManager = new PreviewSseManager();
