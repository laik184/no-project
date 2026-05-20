/**
 * supervisor-agent.ts
 *
 * Central coordinator for the multi-agent system.
 * Routes tasks, monitors agents, detects hallucination,
 * enforces consensus on risky decisions, and manages handoffs.
 */

import { routeTask }                from "./agent-router.ts";
import { partitionContext, buildSystemPrompt } from "./context-partitioner.ts";
import { buildHallucinationReport } from "./hallucination-detector.ts";
import { createProposal, castVote, awaitConsensus } from "./consensus-engine.ts";
import {
  createAssignment, registerTask, startTask,
  completeTask, buildHandoff, summarizeRun, clearRunTasks,
} from "./task-coordinator.ts";
import type {
  AgentRole, AgentResult, AgentMessage, ContextPartition,
} from "./supervisor-types.ts";

// ── Agent runner interface ─────────────────────────────────────────────────────

export type AgentRunner = (
  role:      AgentRole,
  systemPrompt: string,
  goal:      string,
  maxSteps:  number,
  signal?:   AbortSignal,
) => Promise<AgentResult>;

// ── Message bus ───────────────────────────────────────────────────────────────

const _inbox: AgentMessage[] = [];

export function postMessage(msg: Omit<AgentMessage, "id" | "ts">): void {
  const full: AgentMessage = {
    ...msg,
    id: Math.random().toString(36).slice(2),
    ts: Date.now(),
  };
  _inbox.push(full);
  console.log(`[supervisor] Message: ${full.from} → ${full.to} [${full.type}]`);
}

// ── High-stakes decision gating ───────────────────────────────────────────────

const HIGH_STAKES_ACTIONS = [
  /drop\s+table/i, /delete\s+(all|users|data)/i,
  /rm\s+-rf/i, /truncate/i, /production/i,
];

async function requireConsensus(
  description: string,
  proposer:    AgentRole,
  payload:     unknown,
  reviewRole:  AgentRole,
  runner:      AgentRunner,
): Promise<boolean> {
  const proposal = createProposal(description, proposer, payload, [proposer, reviewRole], 1.0);

  // Proposer auto-approves
  castVote({ agentRole: proposer, proposalId: proposal.id, agree: true, reason: "Proposer", confidence: 0.9 });

  // Reviewer votes
  const reviewPrompt = `Review this action and respond with JSON {"agree": true/false, "reason": "..."}:\n${description}`;
  try {
    const reviewResult = await runner(reviewRole, "You are a code reviewer.", reviewPrompt, 2);
    const parsed = JSON.parse(reviewResult.output.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    castVote({
      agentRole: reviewRole, proposalId: proposal.id,
      agree: parsed.agree ?? false, reason: parsed.reason ?? "No reason", confidence: 0.8,
    });
  } catch {
    castVote({ agentRole: reviewRole, proposalId: proposal.id, agree: false, reason: "Parse error", confidence: 0.5 });
  }

  const result = await awaitConsensus(proposal.id, 15_000);
  return result.reached;
}

function isHighStakes(goal: string): boolean {
  return HIGH_STAKES_ACTIONS.some(p => p.test(goal));
}

// ── Supervisor ────────────────────────────────────────────────────────────────

export interface SupervisorOptions {
  runner:    AgentRunner;
  projectId: number;
  runId:     string;
  goal:      string;
  files?:    Array<{ path: string; content: string }>;
  logs?:     string[];
  runtimeInfo?: string;
  planOutput?:  string;
  prevSummary?: string;
  memoryHints?: string[];
}

export interface SupervisorResult {
  success:       boolean;
  finalOutput:   string;
  agentsUsed:    AgentRole[];
  totalSteps:    number;
  confidence:    number;
  hallucinationDetected: boolean;
  runSummary:    ReturnType<typeof summarizeRun>;
}

export async function runSupervisor(opts: SupervisorOptions): Promise<SupervisorResult> {
  const { runner, projectId, runId, goal } = opts;
  const agentsUsed: AgentRole[] = [];
  let hallucinationDetected = false;
  const outputHistory: string[] = [];

  console.log(`[supervisor] Starting run ${runId} — goal: "${goal.slice(0, 60)}"`);

  try {
    // Step 1 — Route to primary agent
    const route = routeTask(goal, opts.logs?.slice(-3).join("\n"));
    console.log(`[supervisor] Route → ${route.primaryRole} (confidence: ${(route.confidence * 100).toFixed(0)}%)`);

    // Step 2 — High-stakes gate
    if (isHighStakes(goal)) {
      const approved = await requireConsensus(goal, route.primaryRole, goal, "review", runner);
      if (!approved) {
        return {
          success: false, finalOutput: "Blocked: high-stakes action requires consensus",
          agentsUsed: [route.primaryRole, "review"], totalSteps: 0,
          confidence: 0, hallucinationDetected: false,
          runSummary: summarizeRun(runId),
        };
      }
    }

    // Step 3 — Primary agent execution
    const primaryCtx = partitionContext(route.primaryRole, {
      goal, projectId, runId,
      codeFiles:   opts.files,
      errorLogs:   opts.logs,
      runtimeInfo: opts.runtimeInfo,
      prevSummary: opts.prevSummary,
      memoryHints: opts.memoryHints,
      planOutput:  opts.planOutput,
    });

    const assignment  = createAssignment(goal, route.primaryRole, projectId, runId, primaryCtx);
    const trackedTask = registerTask(assignment);
    startTask(assignment.taskId);
    agentsUsed.push(route.primaryRole);

    const systemPrompt = buildSystemPrompt(primaryCtx);
    let primaryResult: AgentResult;

    try {
      primaryResult = await runner(route.primaryRole, systemPrompt, goal, assignment.maxSteps);
      outputHistory.push(primaryResult.output);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      primaryResult = { taskId: assignment.taskId, role: route.primaryRole, success: false,
        output: msg, steps: 0, evidence: [], confidence: 0, durationMs: 0 };
    }

    completeTask(assignment.taskId, primaryResult);

    // Step 4 — Hallucination check
    const hallucinationReport = buildHallucinationReport(
      route.primaryRole, outputHistory, primaryResult.output,
      [], primaryCtx.allowedTools,
    );

    if (hallucinationReport.recommendation === "halt") {
      hallucinationDetected = true;
      console.warn(`[supervisor] Hallucination detected for ${route.primaryRole} — halting`);
      return {
        success: false,
        finalOutput: `Agent ${route.primaryRole} showed repetition/hallucination — execution halted`,
        agentsUsed, totalSteps: primaryResult.steps,
        confidence: hallucinationReport.confidence,
        hallucinationDetected: true,
        runSummary: summarizeRun(runId),
      };
    }

    // Step 5 — Secondary agent if needed (e.g., verification after build)
    let finalResult = primaryResult;
    if (!primaryResult.success && route.secondaryRoles.length > 0) {
      const secondaryRole = route.secondaryRoles[0];
      console.log(`[supervisor] Primary failed — handing off to ${secondaryRole}`);

      const handoff = buildHandoff(primaryResult, secondaryRole, "Primary agent failed");
      const secCtx  = partitionContext(secondaryRole, {
        goal: `${goal}\n\n${handoff.carryover}`, projectId, runId,
        codeFiles: opts.files, errorLogs: opts.logs,
      });

      const secAssignment = createAssignment(goal, secondaryRole, projectId, runId, secCtx);
      registerTask(secAssignment);
      startTask(secAssignment.taskId);
      agentsUsed.push(secondaryRole);

      const secPrompt = buildSystemPrompt(secCtx);
      try {
        finalResult = await runner(secondaryRole, secPrompt, goal, secAssignment.maxSteps);
        completeTask(secAssignment.taskId, finalResult);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        finalResult = { ...primaryResult, role: secondaryRole, output: msg };
        completeTask(secAssignment.taskId, finalResult);
      }
    }

    return {
      success:       finalResult.success,
      finalOutput:   finalResult.output,
      agentsUsed,
      totalSteps:    finalResult.steps,
      confidence:    finalResult.confidence,
      hallucinationDetected,
      runSummary:    summarizeRun(runId),
    };

  } finally {
    clearRunTasks(runId);
  }
}
