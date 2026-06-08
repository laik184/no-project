/**
 * preview-lifecycle-manager.ts — High-level lifecycle manager.
 * Single entry point for all lifecycle operations within the preview module.
 */

import { stateMachine }                  from "./lifecycle-state-machine.ts";
import { buildLifecycleSnapshot }        from "./lifecycle-snapshot.ts";
import type { PreviewLifecycleState }    from "../domain/entities/preview-state.ts";
import type { LifecycleApiSnapshot }     from "./lifecycle-snapshot.ts";

export class PreviewLifecycleManager {
  async transition(
    projectId: number,
    to:        PreviewLifecycleState,
    message:   string,
    meta:      Record<string, unknown> = {},
  ): Promise<{ ok: boolean; error?: string }> {
    const result = await stateMachine.transition(projectId, to, message, meta);
    return { ok: result.ok, error: result.error };
  }

  async force(
    projectId: number,
    to:        PreviewLifecycleState,
    message:   string,
    meta:      Record<string, unknown> = {},
  ): Promise<void> {
    await stateMachine.force(projectId, to, message, meta);
  }

  async markBuilding(projectId: number):  Promise<void> {
    await this.force(projectId, "building",  "Building project…");
  }

  async markInstalling(projectId: number): Promise<void> {
    await this.force(projectId, "installing", "Installing dependencies…");
  }

  async markStarting(projectId: number):  Promise<void> {
    await this.force(projectId, "starting",  "Server starting…");
  }

  async markVerifying(projectId: number): Promise<void> {
    await this.transition(projectId, "verifying", "Verifying server health…");
  }

  async markReady(projectId: number, port: number | null = null): Promise<void> {
    await this.transition(projectId, "ready", "Preview is ready.", { port });
  }

  async markCrashed(projectId: number, exitCode: number | null = null): Promise<void> {
    await this.force(projectId, "crashed", "Server crashed.", { exitCode });
  }

  async markSelfHealing(projectId: number): Promise<void> {
    await this.force(projectId, "self_healing", "AI is fixing the crash…");
  }

  async markDebugging(projectId: number): Promise<void> {
    await this.force(projectId, "debugging", "AI is reading logs…");
  }

  async markPatching(projectId: number): Promise<void> {
    await this.force(projectId, "patching", "AI applying patch…");
  }

  async markHotReload(projectId: number, files: string[] = []): Promise<void> {
    await this.force(projectId, "hot_reloading", "Hot reload applied.", { files });
  }

  async markRestarting(projectId: number): Promise<void> {
    await this.force(projectId, "restarting", "Server restarting…");
  }

  async getSnapshot(projectId: number, port: number | null = null): Promise<LifecycleApiSnapshot> {
    return buildLifecycleSnapshot(projectId, port);
  }

  async reset(projectId: number): Promise<void> {
    await stateMachine.reset(projectId);
  }
}

export const lifecycleManager = new PreviewLifecycleManager();
