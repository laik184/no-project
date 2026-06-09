/**
 * seed.ts — Startup seed: ensures at least one project row exists.
 *
 * Called once at boot (before routes mount) so that the default
 * project_id=1 FK reference from agent_runs is always satisfied.
 */
import path        from 'path';
import { db }      from './db/index.ts';
import { eq }      from 'drizzle-orm';
import { projects } from '../../shared/schema.ts';
import { SANDBOX_ROOT } from './config/sandbox.config.ts';

export async function seedDefaultProject(): Promise<void> {
  const existing = await db.select({ id: projects.id, sandboxPath: projects.sandboxPath })
    .from(projects).limit(1);

  if (existing.length > 0) {
    // Patch legacy rows that have no sandboxPath (e.g. created before this fix).
    const row = existing[0];
    if (!row.sandboxPath?.trim()) {
      const defaultSandbox = path.join(SANDBOX_ROOT, 'default-project');
      await db.update(projects)
        .set({ sandboxPath: defaultSandbox })
        .where(eq(projects.id, row.id));
      console.log(`[seed] Patched default project sandboxPath → ${defaultSandbox}`);
    }
    return;
  }

  const defaultSandbox = path.join(SANDBOX_ROOT, 'default-project');
  await db.insert(projects).values({
    name:        'Default Project',
    description: 'Auto-created default project',
    sandboxPath: defaultSandbox,
    status:      'idle',
  });
  console.log(`[seed] Default project created with sandbox → ${defaultSandbox}`);
}
