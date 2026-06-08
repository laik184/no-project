/**
 * preview-service.ts — Top-level preview orchestration service.
 * Coordinates session management and delegates to specialised services.
 * Imports ONLY from repositories/preview/index.ts.
 */

import { previewRepository } from "../../repositories/preview/index.ts";
import {
  createPreviewSession,
  updatePreviewSession,
} from "../../preview/domain/entities/preview-session.ts";
import type { PreviewSession } from "../../preview/domain/entities/preview-session.ts";
import { lifecycleService }    from "./lifecycle-service.ts";
import { runtimeHealthService } from "./runtime-health-service.ts";

let _seq = 0;
function nextSessionId(projectId: number): string {
  return `ps-${projectId}-${Date.now()}-${++_seq}`;
}

export class PreviewService {
  async openSession(projectId: number, port: number | null = null): Promise<PreviewSession> {
    const id      = nextSessionId(projectId);
    const session = createPreviewSession(id, projectId, port);
    await previewRepository.createSession(session);

    await lifecycleService.forceTransition(
      projectId, "starting", "Preview session opened.", { sessionId: id },
    );

    return session;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = await previewRepository.findSessionById(sessionId);
    if (!session) return;

    const closed = updatePreviewSession(session, { status: "closed" });
    await previewRepository.updateSession(closed);

    await lifecycleService.transition(session.projectId, "idle", "Session closed.");
  }

  async updatePort(sessionId: string, port: number): Promise<PreviewSession | null> {
    const session = await previewRepository.findSessionById(sessionId);
    if (!session) return null;

    const updated = updatePreviewSession(session, {
      port,
      url: `http://localhost:${port}`,
    });
    await previewRepository.updateSession(updated);
    return updated;
  }

  async getSession(sessionId: string): Promise<PreviewSession | null> {
    return previewRepository.findSessionById(sessionId);
  }

  async getProjectSessions(projectId: number): Promise<PreviewSession[]> {
    return previewRepository.findSessionsByProjectId(projectId);
  }

  async getFullStatus(projectId: number) {
    const [state, health, sessions] = await Promise.all([
      lifecycleService.getCurrentState(projectId),
      runtimeHealthService.getCached(projectId),
      previewRepository.findSessionsByProjectId(projectId),
    ]);
    return { state, health, sessions };
  }
}

export const previewService = new PreviewService();
