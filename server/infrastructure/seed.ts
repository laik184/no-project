/**
 * seed.ts — Startup seed: ensures at least one project row exists.
 *
 * Called once at boot (before routes mount) so that the default
 * project_id=1 FK reference from agent_runs is always satisfied.
 */
import { db }       from './db/index.ts';
import { projects } from '../../shared/schema.ts';

export async function seedDefaultProject(): Promise<void> {
  const existing = await db.select({ id: projects.id }).from(projects).limit(1);
  if (existing.length > 0) return;

  await db.insert(projects).values({
    name:        'Default Project',
    description: 'Auto-created default project',
    status:      'idle',
  });
  console.log('[seed] Default project created.');
}
