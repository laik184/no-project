/**
 * server/memory/knowledge-graph/graph-builder.ts
 *
 * Purpose: Builds graph entities and relationships from memory entries.
 * Responsibility: Extract named concepts from entries and link them.
 *   Contributes to the graph store; does not own it.
 * Exports: GraphBuilder, graphBuilder (singleton)
 */

import type { MemoryEntry }        from '../types/memory.types.ts';
import type { EntityKind }         from '../types/graph.types.ts';
import { graphStore }              from './graph-store.ts';

// ── Heuristics ────────────────────────────────────────────────────────────────

function categoryToKind(category: MemoryEntry['category']): EntityKind {
  const map: Record<string, EntityKind> = {
    decision:       'decision',
    architecture:   'component',
    bug:            'bug',
    business:       'concept',
    'user-feedback': 'concept',
    revenue:        'metric',
    learning:       'concept',
    prediction:     'concept',
    execution:      'concept',
    conversation:   'concept',
    reflection:     'concept',
    checkpoint:     'concept',
  };
  return map[category] ?? 'concept';
}

function extractLabel(entry: MemoryEntry): string {
  // Use first 60 chars of content as label
  const trimmed = entry.content.slice(0, 60).replace(/\n/g, ' ').trim();
  return trimmed.length < entry.content.length ? `${trimmed}…` : trimmed;
}

function extractConcepts(text: string): string[] {
  // Extract PascalCase and UPPER_CASE identifiers as concepts
  const matches = text.match(/\b([A-Z][a-zA-Z]{2,}|[A-Z_]{3,})\b/g) ?? [];
  return [...new Set(matches)].slice(0, 10);
}

// ── Builder ───────────────────────────────────────────────────────────────────

export class GraphBuilder {

  /**
   * Ingest a memory entry into the knowledge graph.
   * Creates an entity for the entry and links any extracted concepts.
   */
  ingest(entry: MemoryEntry): void {
    const label = extractLabel(entry);
    const existing = graphStore.findEntityByLabel(label);

    const entity = existing ?? graphStore.createEntity({
      id:          entry.id,
      kind:        categoryToKind(entry.category),
      label,
      description: entry.content.slice(0, 200),
      sourceIds:   [entry.id],
      properties:  { category: entry.category, score: entry.score },
    });

    if (existing) {
      graphStore.updateEntity(existing.id, {
        sourceIds: [...new Set([...existing.sourceIds, entry.id])],
      });
    }

    // Extract concept nodes and link them to this entity
    const concepts = extractConcepts(entry.content);
    for (const concept of concepts) {
      let conceptEntity = graphStore.findEntityByLabel(concept);
      if (!conceptEntity) {
        conceptEntity = graphStore.createEntity({
          kind:        'concept',
          label:       concept,
          description: `Concept extracted from ${entry.category} memory`,
          sourceIds:   [entry.id],
        });
      }

      // Create a 'mentions' relationship from entry entity to concept
      const existing = graphStore.relationshipsFrom(entity.id, 'mentions')
        .find(r => r.toId === conceptEntity!.id);
      if (!existing) {
        graphStore.createRelationship({
          fromId: entity.id,
          toId:   conceptEntity.id,
          kind:   'mentions',
          weight: entry.score,
        });
      }
    }
  }

  /**
   * Link two memory entries with an explicit relationship kind.
   */
  link(
    fromEntryId: string,
    toEntryId:   string,
    kind:        import('../types/graph.types.ts').RelationshipKind,
    weight = 0.8,
  ): void {
    const fromEntity = graphStore.getEntity(fromEntryId);
    const toEntity   = graphStore.getEntity(toEntryId);
    if (!fromEntity || !toEntity) return;

    const exists = graphStore.relationshipsFrom(fromEntryId, kind)
      .some(r => r.toId === toEntryId);
    if (!exists) {
      graphStore.createRelationship({ fromId: fromEntryId, toId: toEntryId, kind, weight });
    }
  }
}

export const graphBuilder = new GraphBuilder();
