import { transitionState } from "../state.js";
import type { AgentResult, BackupCode, MFAState } from "../types.js";
import { sha256Hex } from "../utils/hash.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { generateBackupCodes } from "../utils/secret-generator.util.js";

const SOURCE = "backup-code";

export interface BackupCodeGenerateInput {
  readonly userId: string;
  readonly state: Readonly<MFAState>;
}

export interface BackupCodeVerifyInput {
  readonly userId: string;
  readonly code: string;
  readonly state: Readonly<MFAState>;
}

export function generateUserBackupCodes(
  input: BackupCodeGenerateInput,
): Readonly<AgentResult & { rawCodes?: readonly string[] }> {
  const { userId, state } = input;

  const rawCodes = generateBackupCodes();
  const hashedCodes: readonly BackupCode[] = Object.freeze(
    rawCodes.map((raw) =>
      Object.freeze({ codeHash: sha256Hex(raw), used: false }),
    ),
  );

  const existingUser = state.users.find((u) => u.userId === userId);
  if (!existingUser) {
    const errorMsg = `User not found for backup code generation: ${userId}`;
    return {
      nextState: transitionState(state, {
        status: "FAILED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        method: "BACKUP",
        verified: false,
        error: "user_not_found",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const updatedUser = Object.freeze({ ...existingUser, backupCodes: hashedCodes });
  const updatedUsers = state.users.map((u) => (u.userId === userId ? updatedUser : u));
  const log = buildLog(SOURCE, `${rawCodes.length} backup codes generated for user=${userId}`);

  return {
    nextState: transitionState(state, { users: updatedUsers, appendLog: log }),
    output: Object.freeze({
      success: true,
      method: "BACKUP",
      verified: false,
      backupCodes: rawCodes,
      logs: Object.freeze([log]),
    }),
    rawCodes,
  };
}

export function verifyBackupCode(input: BackupCodeVerifyInput): Readonly<AgentResult> {
  const { userId, code, state } = input;

  const user = state.users.find((u) => u.userId === userId);
  if (!user) {
    const errorMsg = `User not found: ${userId}`;
    return {
      nextState: transitionState(state, {
        status: "FAILED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        method: "BACKUP",
        verified: false,
        error: "user_not_found",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const codeHash = sha256Hex(code.toUpperCase());
  const matchedCode = user.backupCodes.find((bc) => bc.codeHash === codeHash && !bc.used);

  if (!matchedCode) {
    const errorMsg = `Invalid or already-used backup code for user=${userId}`;
    return {
      nextState: transitionState(state, {
        status: "FAILED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        method: "BACKUP",
        verified: false,
        error: "invalid_backup_code",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const updatedBackupCodes = user.backupCodes.map((bc) =>
    bc.codeHash === codeHash
      ? Object.freeze({ ...bc, used: true, usedAt: Date.now() })
      : bc,
  );
  const updatedUser = Object.freeze({ ...user, backupCodes: updatedBackupCodes, lastVerifiedAt: Date.now() });
  const updatedUsers = state.users.map((u) => (u.userId === userId ? updatedUser : u));
  const log = buildLog(SOURCE, `Backup code consumed for user=${userId}`);

  return {
    nextState: transitionState(state, { users: updatedUsers, appendLog: log }),
    output: Object.freeze({
      success: true,
      method: "BACKUP",
      verified: true,
      logs: Object.freeze([log]),
    }),
  };
}
