/**
 * server/memory/types/graph.types.ts
 *
 * Purpose: Type contracts for the knowledge graph subsystem.
 * Responsibility: Entity, relationship, and graph query interfaces. No runtime logic.
 * Exports: GraphEntity, GraphRelationship, GraphQuery, GraphPath
 */

// ── Entity ────────────────────────────────────────────────────────────────────

export type EntityKind =
  | 'concept'
  | 'component'
  | 'decision'
  | 'bug'
  | 'pattern'
  | 'person'
  | 'project'
  | 'tool'
  | 'metric';

export interface GraphEntity {
  readonly id:   string;
  kind:          EntityKind;
  label:         string;
  description:   string;
  /** IDs of MemoryEntry records that contributed this entity */
  sourceIds:     string[];
  properties:    Record<string, unknown>;
  createdAt:     number;
  updatedAt:     number;
}

// ── Relationship ──────────────────────────────────────────────────────────────

export type RelationshipKind =
  | 'depends_on'
  | 'causes'
  | 'fixes'
  | 'implements'
  | 'relates_to'
  | 'contradicts'
  | 'extends'
  | 'replaces'
  | 'mentions';

export interface GraphRelationship {
  readonly id:  string;
  fromId:       string;   // source entity id
  toId:         string;   // target entity id
  kind:         RelationshipKind;
  /** Relationship strength: 0.0–1.0 */
  weight:       number;
  label?:       string;
  meta:         Record<string, unknown>;
  createdAt:    number;
}

// ── Graph query ───────────────────────────────────────────────────────────────

export interface GraphQuery {
  /** Starting entity id for traversal */
  fromId?:        string;
  kinds?:         EntityKind[];
  relationKinds?: RelationshipKind[];
  /** Max hops for traversal */
  depth?:         number;
  limit?:         number;
}

// ── Graph path ────────────────────────────────────────────────────────────────

export interface GraphPath {
  entities:      GraphEntity[];
  relationships: GraphRelationship[];
  /** Total weight product along path */
  totalWeight:   number;
}

// ── Graph stats ───────────────────────────────────────────────────────────────

export interface GraphStats {
  entityCount:       number;
  relationshipCount: number;
  connectedComponents: number;
  densityScore:      number;
}

// ── Entity input ──────────────────────────────────────────────────────────────

export interface CreateEntityInput {
  id?:         string;
  kind:        EntityKind;
  label:       string;
  description: string;
  sourceIds?:  string[];
  properties?: Record<string, unknown>;
}

// ── Relationship input ────────────────────────────────────────────────────────

export interface CreateRelationshipInput {
  id?:    string;
  fromId: string;
  toId:   string;
  kind:   RelationshipKind;
  weight?: number;
  label?:  string;
  meta?:   Record<string, unknown>;
}
