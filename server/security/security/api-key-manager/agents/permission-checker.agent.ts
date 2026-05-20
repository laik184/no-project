import { transitionState } from "../state.js";
import type { AgentResult, ApiKeyManagerState, Permission, ValidationResult } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "permission-checker";

export interface PermissionCheckerInput {
  readonly validation: Readonly<ValidationResult>;
  readonly requiredPermission: Permission;
  readonly state: Readonly<ApiKeyManagerState>;
}

export function checkPermission(input: PermissionCheckerInput): Readonly<AgentResult> {
  const { validation, requiredPermission, state } = input;

  if (!validation.valid || !validation.permissions) {
    const errorMsg = "Cannot check permissions on invalid key";
    return {
      nextState: transitionState(state, {
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        valid: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "invalid_key",
      }),
    };
  }

  const hasWildcard = validation.permissions.includes("*");
  const hasPermission = hasWildcard || validation.permissions.includes(requiredPermission);

  if (!hasPermission) {
    const errorMsg = `Permission denied: keyId=${validation.keyId} required=${requiredPermission}`;
    return {
      nextState: transitionState(state, {
        status: "BLOCKED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        valid: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "permission_denied",
      }),
    };
  }

  const log = buildLog(SOURCE, `Permission granted: keyId=${validation.keyId} permission=${requiredPermission}`);
  return {
    nextState: transitionState(state, { appendLog: log }),
    output: Object.freeze({
      success: true,
      valid: true,
      logs: Object.freeze([log]),
    }),
  };
}
