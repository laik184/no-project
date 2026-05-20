import { transitionState } from "../state.js";
import type { AgentResult, ApiKey, ApiKeyManagerState, ApiKeyRequest } from "../types.js";
import { sha256Hex } from "../utils/crypto.util.js";
import { generateKeyId } from "../utils/id-generator.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { buildApiKey } from "../utils/token-format.util.js";
import { daysFromNow } from "../utils/time.util.js";

const SOURCE = "key-generator";
const DEFAULT_PREFIX = "nxk";
const DEFAULT_EXPIRY_DAYS = 365;

export interface KeyGeneratorInput {
  readonly request: ApiKeyRequest;
  readonly state: Readonly<ApiKeyManagerState>;
}

export function generateApiKey(
  input: KeyGeneratorInput,
): Readonly<AgentResult & { rawKey?: string }> {
  const { request, state } = input;

  if (!request.ownerId) {
    const errorMsg = "Missing ownerId for key generation";
    return {
      nextState: transitionState(state, {
        status: "BLOCKED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "missing_owner_id",
      }),
    };
  }

  const { raw, keyPrefix } = buildApiKey(DEFAULT_PREFIX);
  const keyHash = sha256Hex(raw);
  const id = generateKeyId();
  const expiresAt = request.expiresInDays != null
    ? daysFromNow(request.expiresInDays)
    : daysFromNow(DEFAULT_EXPIRY_DAYS);

  const newKey: ApiKey = Object.freeze({
    id,
    keyHash,
    keyPrefix,
    ownerId: request.ownerId,
    name: request.name ?? "Unnamed Key",
    permissions: Object.freeze([...(request.permissions ?? [])]),
    state: "ACTIVE",
    createdAt: Date.now(),
    expiresAt,
  });

  const log = buildLog(SOURCE, `API key generated id=${id} owner=${request.ownerId} prefix=${keyPrefix}`);

  return {
    nextState: transitionState(state, {
      status: "ACTIVE",
      keys: [...state.keys, newKey],
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      key: raw,
      keyId: id,
      metadata: Object.freeze({
        id,
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
