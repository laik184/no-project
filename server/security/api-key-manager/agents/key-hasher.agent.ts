import { transitionState } from "../state.js";
import type { AgentResult, ApiKeyManagerState } from "../types.js";
import { sha256Hex, timingSafeCompare } from "../utils/crypto.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "key-hasher";

export interface HashInput {
  readonly rawKey: string;
  readonly state: Readonly<ApiKeyManagerState>;
}

export interface CompareInput {
  readonly rawKey: string;
  readonly storedHash: string;
  readonly state: Readonly<ApiKeyManagerState>;
}

export function hashKey(input: HashInput): Readonly<AgentResult & { keyHash?: string }> {
  const { rawKey, state } = input;

  if (!rawKey) {
    const errorMsg = "Cannot hash empty key";
    return {
      nextState: transitionState(state, {
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "empty_key",
      }),
    };
  }

  const keyHash = sha256Hex(rawKey);
  const log = buildLog(SOURCE, "Key hashed successfully");
  return {
    nextState: transitionState(state, { appendLog: log }),
    output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
    keyHash,
  };
}

export function compareKeyHash(input: CompareInput): boolean {
  const incomingHash = sha256Hex(input.rawKey);
  return timingSafeCompare(incomingHash, input.storedHash);
}
