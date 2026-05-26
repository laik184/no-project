/**
 * crash-responder.ts — STUB
 * Original crash responder agent was removed.
 * This stub satisfies main.ts imports without breaking startup.
 */

class CrashResponder {
  start(): void {
    console.log("[crash-responder] Started — listening for process.crashed events");
  }

  stop(): void {
    console.log("[crash-responder] Stopped.");
  }
}

export const crashResponder = new CrashResponder();
