/**
 * preview-store.ts — In-memory store for PreviewSession and PreviewState.
 * Implements CRUD for the persistence layer.
 * Imports ONLY from infrastructure/index.ts.
 */

import type { PreviewSession } from "../preview/domain/entities/preview-session.ts";
import type { PreviewState }   from "../preview/domain/entities/preview-state.ts";

// ── Session store ──────────────────────────────────────────────────────────────

const sessions = new Map<string, PreviewSession>();
const sessionsByProject = new Map<number, Set<string>>();

export const previewSessionStore = {
  create(session: PreviewSession): void {
    sessions.set(session.id, session);
    const set = sessionsByProject.get(session.projectId) ?? new Set();
    set.add(session.id);
    sessionsByProject.set(session.projectId, set);
  },

  update(session: PreviewSession): void {
    if (!sessions.has(session.id)) {
      throw new Error(`[preview-store] Session not found: ${session.id}`);
    }
    sessions.set(session.id, session);
  },

  delete(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (!session) return;
    sessions.delete(sessionId);
    const set = sessionsByProject.get(session.projectId);
    if (set) {
      set.delete(sessionId);
      if (set.size === 0) sessionsByProject.delete(session.projectId);
    }
  },

  findById(sessionId: string): PreviewSession | null {
    return sessions.get(sessionId) ?? null;
  },

  findByProjectId(projectId: number): PreviewSession[] {
    const ids = sessionsByProject.get(projectId) ?? new Set();
    return Array.from(ids)
      .map(id => sessions.get(id))
      .filter((s): s is PreviewSession => s !== undefined);
  },

  findAll(): PreviewSession[] {
    return Array.from(sessions.values());
  },
};

// ── State store ────────────────────────────────────────────────────────────────

const states = new Map<number, PreviewState>();

export const previewStateStore = {
  save(state: PreviewState): void {
    states.set(state.projectId, state);
  },

  findByProjectId(projectId: number): PreviewState | null {
    return states.get(projectId) ?? null;
  },

  findAll(): PreviewState[] {
    return Array.from(states.values());
  },

  delete(projectId: number): void {
    states.delete(projectId);
  },
};
