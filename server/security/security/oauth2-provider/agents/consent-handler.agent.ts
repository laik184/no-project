import { transitionState } from "../state.js";
import type { AgentResult, OAuthProviderState, OAuthRequest } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "consent-handler";

export interface ConsentInput {
  readonly request: OAuthRequest;
  readonly state: Readonly<OAuthProviderState>;
  readonly userId: string;
  readonly scopes: readonly string[];
}

export function handleConsent(input: ConsentInput): Readonly<AgentResult> {
  const { request, state, userId, scopes } = input;

  if (!request.consentGiven) {
    const errorMsg = `User ${userId} did not grant consent for scopes: ${scopes.join(" ")}`;
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "access_denied", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  const log = buildLog(SOURCE, `Consent granted by user ${userId} for scopes: ${scopes.join(" ")}`);
  return {
    nextState: transitionState(state, { appendLog: log }),
    output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
  };
}
