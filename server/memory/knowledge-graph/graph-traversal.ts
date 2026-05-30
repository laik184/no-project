/**
 * server/memory/knowledge-graph/graph-traversal.ts
 *
 * Purpose: BFS and DFS traversal algorithms over the knowledge graph.
 * Responsibility: Path finding, neighbor lookup, subgraph extraction.
 *   Reads from the graph store; does not mutate it.
 * Exports: GraphTraversal, graphTraversal (singleton)
 */

import { graphStore }      from './graph-store.ts';
import type {
  GraphEntity,
  GraphRelationship,
  GraphQuery,
  GraphPath,
} from '../types/graph.types.ts';

// ── Traversal ─────────────────────────────────────────────────────────────────

export class GraphTraversal {

  /**
   * Breadth-first search from a starting entity.
   * Returns all reachable entities within `depth` hops.
   */
  bfs(fromId: string, depth = 2): GraphEntity[] {
    const visited = new Set<string>([fromId]);
    const queue   = [{ id: fromId, hop: 0 }];
    const result:  GraphEntity[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const entity  = graphStore.getEntity(current.id);
      if (entity) result.push(entity);
      if (current.hop >= depth) continue;

      const rels = [
        ...graphStore.relationshipsFrom(current.id),
        ...graphStore.relationshipsTo(current.id),
      ];
      for (const rel of rels) {
        const next = rel.fromId === current.id ? rel.toId : rel.fromId;
        if (!visited.has(next)) {
          visited.add(next);
          queue.push({ id: next, hop: current.hop + 1 });
        }
      }
    }

    return result;
  }

  /**
   * Find the shortest path between two entities using BFS.
   */
  shortestPath(fromId: string, toId: string): GraphPath | null {
    if (fromId === toId) {
      const entity = graphStore.getEntity(fromId);
      return entity
        ? { entities: [entity], relationships: [], totalWeight: 1 }
        : null;
    }

    const visited  = new Set<string>([fromId]);
    const queue    = [{ id: fromId, path: [] as GraphRelationship[] }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const rels    = graphStore.relationshipsFrom(current.id);

      for (const rel of rels) {
        if (visited.has(rel.toId)) continue;
        visited.add(rel.toId);
        const newPath = [...current.path, rel];

        if (rel.toId === toId) {
          const entityIds = [fromId, ...newPath.map(r => r.toId)];
          const entities  = entityIds
            .map(id => graphStore.getEntity(id))
            .filter(Boolean) as GraphEntity[];
          const weight    = newPath.reduce((w, r) => w * r.weight, 1);
          return { entities, relationships: newPath, totalWeight: weight };
        }

        queue.push({ id: rel.toId, path: newPath });
      }
    }

    return null;
  }

  /**
   * Execute a structured graph query.
   */
  query(q: GraphQuery): GraphEntity[] {
    let entities = graphStore.listEntities();

    if (q.kinds && q.kinds.length > 0) {
      const allowed = new Set(q.kinds);
      entities = entities.filter(e => allowed.has(e.kind));
    }

    if (q.fromId) {
      const reachable = new Set(
        this.bfs(q.fromId, q.depth ?? 2).map(e => e.id),
      );
      entities = entities.filter(e => reachable.has(e.id));
    }

    return entities.slice(0, q.limit ?? 50);
  }

  /**
   * Return direct neighbours of an entity (one hop, outgoing + incoming).
   */
  neighbours(entityId: string): GraphEntity[] {
    const rels = [
      ...graphStore.relationshipsFrom(entityId),
      ...graphStore.relationshipsTo(entityId),
    ];
    const ids = new Set(
      rels.map(r => r.fromId === entityId ? r.toId : r.fromId),
    );
    return [...ids]
      .map(id => graphStore.getEntity(id))
      .filter(Boolean) as GraphEntity[];
  }
}

export const graphTraversal = new GraphTraversal();
