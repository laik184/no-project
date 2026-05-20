import { transitionState } from "../state.js";
import type { AgentResult, ApiKey, ApiKeyManagerState } from "../types.js";
import { sha256Hex } from "../utils/crypto.util.js";
import { generateKeyId } from "../utils/id-generator.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { buildApiKey } from "../utils/token-format.util.js";
import { daysFromNow, nowMs } from "../utils/time.util.js";

const SOURCE = "key-rotation";
const DEFAULT_PREFIX = "nxk";
const DEFAULT_EXPIRY_DAYS = 365;

export interface RotationInput {
  readonly keyId: string;
  readonly expiresInDays?: number;
  readonly state: Readonly<ApiKeyManagerState>;
}

export function rotateApiKey(
  input: RotationInput,
): Readonly<AgentResult & { rawKey?: string }> {
  const { keyId, expiresInDays, state } = input;

  const existing = state.keys.find((k) => k.id === keyId && k.state === "ACTIVE");
  if (!existing) {
    const errorMsg = `Key not found or not active for rotation: ${keyId}`;
    return {
      nextState: transitionState(state, {
        status: "BLOCKED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "key_not_found_or_inactive",
      }),
    };
  }

  const { raw, keyPrefix } = buildApiKey(DEFAULT_PREFIX);
  const newKeyHash = sha256Hex(raw);
  const newId = generateKeyId();
  const expiresAt = daysFromNow(expiresInDays ?? DEFAULT_EXPIRY_DAYS);

  const rotatedOld: ApiKey = Object.freeze({
    ...existing,
    state: "ROTATED",
    rotatedAt: nowMs(),
  });

  const newKey: ApiKey = Object.freeze({
    id: newId,
    keyHash: newKeyHash,
    keyPrefix,
    ownerId: existing.ownerId,
    name: existing.name,
    permissions: Object.freeze([...existing.permissions]),
    state: "ACTIVE",
    createdAt: nowMs(),
    expiresAt,
  });

  const updatedKeys = state.keys.map((k) => (k.id === keyId ? rotatedOld : k));
  const log = buildLog(SOURCE, `Key rotated: old=${keyId} new=${newId} owner=${existing.ownerId}`);

  return {
    nextState: transitionState(state, {
      keys: [...updatedKeys, newKey],
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      key: raw,
      keyId: newId,
      metadata: Object.freeze({
        id: newId,
        name: newKey.name,
        ownerId: newKey.ownerId,
        keyPrefix,
        permissions: newKey.permissions,
        state: "ACTIVE",
        createdAt: newKey.createdAt,
        expiresAt,
      }),
      logs: Object.freeze([log]),
    }),
    rawKey: raw,
  };
}
