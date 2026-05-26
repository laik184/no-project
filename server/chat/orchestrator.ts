import { Router } from "express";
import type { Server } from "http";
import { runManager } from "./run/controller.ts";
import { runs } from "./run/registry.ts";
import { pendingCount } from "./run/question-bus.ts";
import { createSseRouter } from "./streams/sse.ts";
import { attachWebSocketServer } from "./streams/ws-server.ts";
import { startConsoleLogPersister } from "./events/console-log-persister.ts";
import { createChatMessagesRouter } from "./routes/messages.routes.ts";
import { createChatHistoryRouter } from "./routes/history.routes.ts";
import { createChatFeedbackRouter } from "./routes/feedback.routes.ts";
import { createChatPromptsRouter } from "./routes/prompts.routes.ts";
import { createChatUploadRouter } from "./routes/upload.routes.ts";
import { createChatStreamRouter } from "./routes/stream.routes.ts";
import type { RegistryStats } from "../tools/registry/tool-types.ts";

function getMetrics(): Record<string, unknown> { return {}; }

class ChatOrchestrator {
  readonly runRegistry = runs;

  readonly questions = {
    pendingCount,
  };

  readonly pipeline = {
    getMetrics,
    registry: {
      getStats(): RegistryStats {
        return {
          totalTools: 0,
          totalCalls: 0,
          totalSuccesses: 0,
          totalFailures: 0,
          activeConcurrentCalls: 0,
          categoryCounts: {} as any,
          perTool: [],
        };
      },
    },
  };

  buildChatRouter(): Router {
    const router = Router();

    router.post("/chat/run", async (req, res) => {
      try {
        const input = req.body;
        if (!input?.projectId || !input?.goal) {
          return res.status(400).json({ ok: false, error: "projectId and goal are required" });
        }
        const handle = await runManager.runGoal(input);
        res.json({ ok: true, runId: handle.runId });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message ?? String(e) });
      }
    });

    router.post("/chat/cancel/:runId", (req, res) => {
      const ok = runManager.cancel(req.params.runId);
      res.json({ ok });
    });

    router.get("/chat/run/:runId", (req, res) => {
      const handle = runManager.get(req.params.runId);
      if (!handle) return res.status(404).json({ ok: false, error: "Run not found" });
      res.json({ ok: true, run: handle });
    });

    router.use(createChatMessagesRouter());
    router.use(createChatHistoryRouter());
    router.use(createChatFeedbackRouter());
    router.use(createChatPromptsRouter());
    router.use(createChatUploadRouter());
    router.use(createChatStreamRouter());

    return router;
  }

  buildSseRouter(): Router {
    return createSseRouter();
  }

  attachWebSocket(server: Server): void {
    attachWebSocketServer(server);
  }

  startPersistence(): void {
    startConsoleLogPersister();
  }
}

export const chatOrchestrator = new ChatOrchestrator();
