import type { OAuthProviderState, StatePatch } from "./types.js";

export const INITIAL_STATE: Readonly<OAuthProviderState> = Object.freeze({
  clients: Object.freeze([]),
  authCodes: Object.freeze([]),
  accessTokens: Object.freeze([]),
  refreshTokens: Object.freeze([]),
  revokedTokens: Object.freeze([]),
  status: "IDLE",
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});

export function transitionState(
  current: Readonly<OAuthProviderState>,
  patch: StatePatch,
): Readonly<OAuthProviderState> {
  const nextLogs = patch.appendLog
    ? Object.freeze([...current.logs, patch.appendLog])
    : current.logs;

  const nextErrors = patch.appendError
    ? Object.freeze([...current.errors, patch.appendError])
    : current.errors;

  return Object.freeze({
    clients: patch.clients !== undefined ? Object.freeze([...patch.clients]) : current.clients,
    authCodes: patch.authCodes !== undefined ? Object.freeze([...patch.authCodes]) : current.authCodes,
    accessTokens: patch.accessTokens !== undefined ? Object.freeze([...patch.accessTokens]) : current.accessTokens,
    refreshTokens: patch.refreshTokens !== undefined ? Object.freeze([...patch.refreshTokens]) : current.refreshTokens,
    revokedTokens: patch.revokedTokens !== undefined ? Object.freeze([...patch.revokedTokens]) : current.revokedTokens,
    status: patch.status ?? current.status,
    logs: nextLogs,
    errors: nextErrors,
  });
}
