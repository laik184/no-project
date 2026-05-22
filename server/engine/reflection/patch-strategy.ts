/**
 * server/engine/reflection/patch-strategy.ts
 *
 * Patch plan generator for the Reflection Engine.
 *
 * Single responsibility: given a classified failure + analysis context,
 * produce a structured PatchPlan. No execution, no I/O, no bus.
 *
 * Patch plans are consumed by the tool-loop (via reflection.completed event)
 * to guide the next LLM turn with concrete, targeted actions.
 */

import type {
  ReflectionClassification,
  ReflectionContext,
  PatchPlan,
  PatchAction,
} from "./reflection-types.ts";
import { extractMissingPackages } from "./reflection-analyzer.ts";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a PatchPlan from the failure classification and runtime context.
 * Returns a deterministic, targeted repair plan — never "try something random".
 */
export function buildPatchPlan(
  classification: ReflectionClassification,
  context:        ReflectionContext,
): PatchPlan {
  const actions: PatchAction[] = [];

  switch (classification.primary) {
    case "runtime_crash":
    case "memory_leak":
    case "process_exit": {
      actions.push({ type: "restart_server", reason: `${classification.primary} detected` });
      break;
    }

    case "port_conflict": {
      const port = context.port ?? 3000;
      actions.push({ type: "clear_port", port });
      actions.push({ type: "restart_server", reason: "Port conflict cleared — restarting" });
      break;
    }

    case "port_timeout": {
      actions.push({
        type: "restart_server",
        reason: "Port did not open in time — restart with fresh port allocation",
      });
      break;
    }

    case "dependency_missing": {
      const packages = extractMissingPackages(context.logTail);
      if (packages.length > 0) {
        actions.push({ type: "install_deps", packages });
      } else {
        actions.push({ type: "install_deps", packages: [] }); // trigger npm install
      }
      actions.push({ type: "restart_server", reason: "Dependencies installed — restart required" });
      break;
    }

    case "syntax_error":
    case "typescript_error": {
      const hint = classification.evidence[0] ?? "Check TypeScript/syntax errors in recent files";
      actions.push({ type: "fix_typescript", hint });
      break;
    }

    case "build_failure": {
      const hint = classification.evidence[0] ?? "Fix build configuration or compilation errors";
      actions.push({ type: "fix_typescript", hint });
      break;
    }

    case "infinite_render_loop": {
      actions.push({
        type: "fix_typescript",
        hint: "Fix infinite render loop — check useEffect dependencies or state mutation in render",
      });
      break;
    }

    case "hydration_failure": {
      actions.push({
        type: "fix_typescript",
        hint: "Fix React hydration mismatch — check for server/client render differences",
      });
      break;
    }

    case "preview_proxy_failure":
    case "preview_blank": {
      actions.push({ type: "restart_server", reason: "Preview unreachable — restart server" });
      break;
    }

    case "timeout": {
      actions.push({
        type: "change_approach",
        hint: "Operation timed out — check for blocking I/O or infinite awaits",
      });
      break;
    }

    case "verification_failure": {
      actions.push({ type: "restart_server", reason: "Verification failed — restart to clear state" });
      break;
    }

    case "tool_loop": {
      actions.push({
        type: "change_approach",
        hint: "Tool loop detected — stop repeating the same tool. Try a different approach.",
      });
      break;
    }

    default: {
      actions.push({
        type: "escalate",
        reason: `Unknown failure class "${classification.primary}" — manual review required`,
      });
      break;
    }
  }

  const restartNeeded = actions.some(
    (a) => a.type === "restart_server" || a.type === "clear_port",
  );

  const rollbackFirst = classification.primary === "memory_leak"
    || classification.primary === "build_failure";

  const estimatedFixMs =
    classification.primary === "dependency_missing" ? 30_000 :
    classification.primary === "runtime_crash"      ? 10_000 :
    restartNeeded                                   ?  8_000 : 3_000;

  const actionNames = actions.map((a) => a.type).join(", ");

  return {
    actions,
    estimatedFixMs,
    restartNeeded,
    rollbackFirst,
    summary: `[${classification.primary}] severity=${classification.severity} → ${actionNames}`,
  };
}
