import { transitionState } from "../state.js";
import type { AgentResult, ApiKeyManagerState, ValidationResult } from "../types.js";
import { sha256Hex, timingSafeCompare } from "../utils/crypto.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { isValidKeyFormat } from "../utils/token-format.util.js";
import { isExpired } from "../utils/time.util.js";

const SOURCE = "key-validator";

export interface ValidatorInput {
  readonly rawKey: string;
  readonly state: Readonly<ApiKeyManagerState>;
}

export function validateApiKey(
  input: ValidatorInput,
): Readonly<AgentResult & { validation?: ValidationResult }> {
  const { rawKey, state } = input;

  if (!isValidKeyFormat(rawKey)) {
    const errorMsg = "Invalid API key format";
    return {
      nextState: transitionState(state, {
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        valid: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "invalid_format",
      }),
      validation: Object.freeze({ valid: false, reason: "invalid_format" }),
    };
  }

  const incomingHash = sha256Hex(rawKey);
  const matched = state.keys.find(
    (k) => timingSafeCompare(incomingHash, k.keyHash),
  );

  if (!matched) {
    const errorMsg = "API key not found";
    return {
      nextState: transitionState(state, {
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        valid: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "key_not_found",
      }),
      validation: Object.freeze({ valid: false, reason: "key_not_found" }),
    };
  }

  if (matched.state !== "ACTIVE") {
    const errorMsg = `API key is ${matched.state}: ${matched.id}`;
    return {
      nextState: transitionState(state, {
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        valid: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: `key_${matched.state.toLowerCase()}`,
      }),
      validation: Object.freeze({ valid: false, reason: matched.state.toLowerCase() }),
    };
  }

  if (isExpired(matched.expiresAt)) {
    const errorMsg = `API key expired: ${matched.id}`;
    const updatedKeys = state.keys.map((k) =>
      k.id === matched.id ? Object.freeze({ ...k, state: "EXPIRED" as const }) : k,
    );
    return {
      nextState: transitionState(state, {
        keys: updatedKeys,
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        valid: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "key_expired",
      }),
      validation: Object.freeze({ valid: false, reason: "key_expired" }),
    };
  }

  const log = buildLog(SOURCE, `API key valid: id=${matched.id} owner=${matched.ownerId}`);
  return {
    nextState: transitionState(state, { appendLog: log }),
    output: Object.freeze({
      success: true,
      valid: true,
      keyId: matched.id,
      logs: Object.freeze([log]),
    }),
    validation: Object.freeze({
      valid: true,
      keyId: matched.id,
      ownerId: matched.ownerId,
      permissions: matched.permissions,
    }),
  };
}
