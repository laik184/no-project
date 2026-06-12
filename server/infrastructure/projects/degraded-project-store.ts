/**
 * In-memory project store used only when DATABASE_URL is not configured.
 *
 * The autonomous runtime must still be able to create files, run a sandbox, and
 * serve previews in local/degraded mode. This store provides that minimal
 * project catalog without pretending persistence exists.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SANDBOX_ROOT } from '../config/sandbox.config.ts';

export interface DegradedProjectRecord {
  id: number;
  name: string;
  description: string | null;
  framework: string | null;
  sandboxPath: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const projects = new Map<number, DegradedProjectRecord>();
let nextProjectId = 1;

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return slug || 'project';
}

function makeProject(input: {
  id?: number;
  name: string;
  description?: string | null;
  framework?: string | null;
  sandboxPath?: string;
  status?: string;
}): DegradedProjectRecord {
  const now = new Date();
  const id = input.id ?? nextProjectId++;
  if (id >= nextProjectId) nextProjectId = id + 1;
  const sandboxPath = resolve(input.sandboxPath ?? `${SANDBOX_ROOT}/${slugify(input.name)}-${Date.now()}`);
  ensureDir(sandboxPath);
  return {
    id,
    name: input.name,
    description: input.description ?? null,
    framework: input.framework ?? null,
    sandboxPath,
    status: input.status ?? 'idle',
    createdAt: now,
    updatedAt: now,
  };
}

function ensureDefaultProject(): DegradedProjectRecord {
  const existing = projects.get(1);
  if (existing) return existing;
  const project = makeProject({
    id: 1,
    name: 'Local Sandbox',
    description: 'Degraded-mode project backed by AGENT_PROJECT_ROOT/SANDBOX_ROOT.',
    framework: null,
    sandboxPath: SANDBOX_ROOT,
    status: 'idle',
  });
  projects.set(project.id, project);
  return project;
}

export const degradedProjectStore = {
  list(): DegradedProjectRecord[] {
    ensureDefaultProject();
    return [...projects.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  },

  get(id: number): DegradedProjectRecord | null {
    if (id === 1) return ensureDefaultProject();
    return projects.get(id) ?? null;
  },

  create(input: { name: string; description?: string | null; framework?: string | null }): DegradedProjectRecord {
    const project = makeProject(input);
    projects.set(project.id, project);
    return project;
  },

  update(id: number, patch: Partial<Pick<DegradedProjectRecord, 'name' | 'description' | 'framework' | 'status'>>): DegradedProjectRecord | null {
    const current = this.get(id);
    if (!current) return null;
    const updated = { ...current, ...patch, updatedAt: new Date() };
    projects.set(id, updated);
    return updated;
  },
};
