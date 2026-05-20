import { transitionState } from "../state.js";
import type { AgentResult, OAuthClient, OAuthProviderState } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "scope-validator";

export interface ScopeValidationInput {
  readonly requestedScopes: readonly string[];
  readonly client: Readonly<OAuthClient>;
  readonly state: Readonly<OAuthProviderState>;
}

export function validateScopes(input: ScopeValidationInput): Readonly<AgentResult> {
  const { requestedScopes, client, state } = input;

  if (requestedScopes.length === 0) {
    const errorMsg = "No scopes requested";
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "invalid_scope", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  const disallowedScopes = requestedScopes.filter(
    (scope) => !client.allowedScopes.includes(scope),
  );

  if (disallowedScopes.length > 0) {
    const errorMsg = `Scopes not permitted for client: ${disallowedScopes.join(", ")}`;
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "invalid_scope", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  const log = buildLog(SOURCE, `Scopes validated: ${requestedScopes.join(" ")}`);
  return {
    nextState: transitionState(state, { appendLog: log }),
    output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
  };
}

export function intersectScopes(
  requested: readonly string[],
  allowed: readonly string[],
): readonly string[] {
  return Object.freeze(requested.filter((s) => allowed.includes(s)));
}
