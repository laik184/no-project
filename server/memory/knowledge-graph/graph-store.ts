/**
 * server/memory/knowledge-graph/graph-store.ts
 *
 * Purpose: In-memory + file-persisted store for graph entities and relationships.
 * Responsibility: CRUD for entities and relationships. No traversal logic.
 * Exports: GraphStore, graphStore (singleton)
 */

import { randomUUID }       from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join }             from 'path';
import type {
  GraphEntity,
  GraphRelationship,
  CreateEntityInput,
  CreateRelationshipInput,
  EntityKind,
  RelationshipKind,
  GraphStats,
} from '../types/graph.types.ts';

const DATA_DIR = join(process.cwd(), '.data', 'memory', 'knowledge-graph');

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

// ── Store ─────────────────────────────────────────────────────────────────────

export class GraphStore {
  private entities      = new Map<string, GraphEntity>();
  private relationships = new Map<string, GraphRelationship>();

  constructor() { this.load(); }

  // ── Entities ──────────────────────────────────────────────────────────────

  createEntity(input: CreateEntityInput): GraphEntity {
    const now    = Date.now();
    const entity: GraphEntity = {
      id:          input.id ?? randomUUID(),
      kind:        input.kind,
      label:       input.label,
      description: input.description,
      sourceIds:   input.sourceIds ?? [],
      properties:  input.properties ?? {},
      createdAt:   now,
      updatedAt:   now,
    };
    this.entities.set(entity.id, entity);
    this.persist();
    return entity;
  }

  getEntity(id: string): GraphEntity | undefined {
    return this.entities.get(id);
  }

  updateEntity(id: string, patch: Partial<Omit<GraphEntity, 'id' | 'createdAt'>>): GraphEntity | undefined {
    const existing = this.entities.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id: existing.id, updatedAt: Date.now() };
    this.entities.set(id, updated);
    this.persist();
    return updated;
  }

  deleteEntity(id: string): boolean {
    const deleted = this.entities.delete(id);
    // Remove dangling relationships
    for (const [rid, r] of this.relationships) {
      if (r.fromId === id || r.toId === id) this.relationships.delete(rid);
    }
    if (deleted) this.persist();
    return deleted;
  }

  listEntities(kind?: EntityKind): GraphEntity[] {
    const all = [...this.entities.values()];
    return kind ? all.filter(e => e.kind === kind) : all;
  }

  findEntityByLabel(label: string): GraphEntity | undefined {
    const q = label.toLowerCase();
    return [...this.entities.values()].find(e => e.label.toLowerCase() === q);
  }

  // ── Relationships ─────────────────────────────────────────────────────────

  createRelationship(input: CreateRelationshipInput): GraphRelationship {
    const rel: GraphRelationship = {
      id:        input.id ?? randomUUID(),
      fromId:    input.fromId,
      toId:      input.toId,
      kind:      input.kind,
      weight:    input.weight ?? 1.0,
      label:     input.label,
      meta:      input.meta ?? {},
      createdAt: Date.now(),
    };
    this.relationships.set(rel.id, rel);
    this.persist();
    return rel;
  }

  getRelationship(id: string): GraphRelationship | undefined {
    return this.relationships.get(id);
  }

  deleteRelationship(id: string): boolean {
    const deleted = this.relationships.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  relationshipsFrom(entityId: string, kind?: RelationshipKind): GraphRelationship[] {
    return [...this.relationships.values()].filter(
      r => r.fromId === entityId && (!kind || r.kind === kind),
    );
  }

  relationshipsTo(entityId: string, kind?: RelationshipKind): GraphRelationship[] {
    return [...this.relationships.values()].filter(
      r => r.toId === entityId && (!kind || r.kind === kind),
    );
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  stats(): GraphStats {
    const entityCount       = this.entities.size;
    const relationshipCount = this.relationships.size;
    const densityScore      = entityCount > 1
      ? relationshipCount / (entityCount * (entityCount - 1))
      : 0;
    return { entityCount, relationshipCount, connectedComponents: 0, densityScore };
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private persist(): void {
    try {
      ensureDir();
      writeFileSync(
        join(DATA_DIR, 'entities.json'),
        JSON.stringify([...this.entities.values()], null, 0),
        'utf8',
      );
      writeFileSync(
        join(DATA_DIR, 'relationships.json'),
        JSON.stringify([...this.relationships.values()], null, 0),
        'utf8',
      );
    } catch { /* non-fatal */ }
  }

  private load(): void {
    try {
      const ep = join(DATA_DIR, 'entities.json');
      if (existsSync(ep)) {
        const ents = JSON.parse(readFileSync(ep, 'utf8')) as GraphEntity[];
        for (const e of ents) this.entities.set(e.id, e);
      }
      const rp = join(DATA_DIR, 'relationships.json');
      if (existsSync(rp)) {
        const rels = JSON.parse(readFileSync(rp, 'utf8')) as GraphRelationship[];
        for (const r of rels) this.relationships.set(r.id, r);
      }
    } catch { /* corrupted — start fresh */ }
  }
}

export const graphStore = new GraphStore();
