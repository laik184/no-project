/**
 * preview-repository.ts — Concrete implementation of IPreviewRepository.
 * Imports ONLY from preview-persistence/index.ts.
 */

import {
  previewSessionStore,
  previewStateStore,
  previewCache,
  CacheKey,
  TTL,
} from "../../preview-persistence/index.ts";
import type { IPreviewRepository } from "../../preview/domain/interfaces/preview-repository.ts";
import type { PreviewSession }     from "../../preview/domain/entities/preview-session.ts";
import type { PreviewState }       from "../../preview/domain/entities/preview-state.ts";

class PreviewRepository implements IPreviewRepository {
  // ── Sessions ───────────────────────────────────────────────────────────────

  async createSession(session: PreviewSession): Promise<void> {
    previewSessionStore.create(session);
    previewCache.set(CacheKey.session(session.id), session, TTL.SESSION);
  }

  async updateSession(session: PreviewSession): Promise<void> {
    previewSessionStore.update(session);
    previewCache.set(CacheKey.session(session.id), session, TTL.SESSION);
  }

  async deleteSession(sessionId: string): Promise<void> {
    previewSessionStore.delete(sessionId);
    previewCache.delete(CacheKey.session(sessionId));
  }

  async findSessionById(sessionId: string): Promise<PreviewSession | null> {
    const cached = previewCache.get<PreviewSession>(CacheKey.session(sessionId));
    if (cached) return cached;

    const session = previewSessionStore.findById(sessionId);
    if (session) {
      previewCache.set(CacheKey.session(sessionId), session, TTL.SESSION);
    }
    return session;
  }

  async findSessionsByProjectId(projectId: number): Promise<PreviewSession[]> {
    return previewSessionStore.findByProjectId(projectId);
  }

  async findAllSessions(): Promise<PreviewSession[]> {
    return previewSessionStore.findAll();
  }

  // ── State ──────────────────────────────────────────────────────────────────

  async saveState(state: PreviewState): Promise<void> {
    previewStateStore.save(state);
    previewCache.set(CacheKey.state(state.projectId), state, TTL.STATE);
  }

  async findState(projectId: number): Promise<PreviewState | null> {
    const cached = previewCache.get<PreviewState>(CacheKey.state(projectId));
    if (cached) return cached;

    const state = previewStateStore.findByProjectId(projectId);
    if (state) {
      previewCache.set(CacheKey.state(projectId), state, TTL.STATE);
    }
    return state;
  }

  async findAllStates(): Promise<PreviewState[]> {
    return previewStateStore.findAll();
  }

  async deleteState(projectId: number): Promise<void> {
    previewStateStore.delete(projectId);
    previewCache.delete(CacheKey.state(projectId));
  }
}

export const previewRepository = new PreviewRepository();
