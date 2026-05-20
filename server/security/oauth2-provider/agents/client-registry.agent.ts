import { transitionState } from "../state.js";
import type { AgentResult, OAuthClient, OAuthProviderState, OAuthRequest } from "../types.js";
import { hashSecret, timingSafeEqual } from "../utils/crypto.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "client-registry";

export interface ClientRegistryInput {
  readonly request: OAuthRequest;
  readonly state: Readonly<OAuthProviderState>;
}

export function validateClient(input: ClientRegistryInput): Readonly<AgentResult> {
  const { request, state } = input;

  const client = state.clients.find((c) => c.clientId === request.clientId);
  if (!client) {
    const errorMsg = `Unknown client_id: ${request.clientId}`;
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        error: "invalid_client",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  if (request.clientSecret !== undefined) {
    const secretHash = hashSecret(request.clientSecret);
    if (!timingSafeEqual(secretHash, client.clientSecretHash)) {
      const errorMsg = "Client secret mismatch";
      return {
        nextState: transitionState(state, {
          status: "ERROR",
          appendError: buildError(SOURCE, errorMsg),
          appendLog: buildLog(SOURCE, errorMsg),
        }),
        output: Object.freeze({
          success: false,
          error: "invalid_client",
          logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        }),
      };
    }
  }

  const log = buildLog(SOURCE, `Client validated: ${request.clientId}`);
  return {
    nextState: transitionState(state, { appendLog: log }),
    output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
  };
}

export function registerClient(
  client: Omit<OAuthClient, "clientSecretHash"> & { clientSecret: string },
  state: Readonly<OAuthProviderState>,
): Readonly<AgentResult> {
  const secretHash = hashSecret(client.clientSecret);
  const newClient: OAuthClient = Object.freeze({
    clientId: client.clientId,
    clientSecretHash: secretHash,
    redirectUris: Object.freeze([...client.redirectUris]),
    allowedScopes: Object.freeze([...client.allowedScopes]),
    name: client.name,
    createdAt: Date.now(),
  });

  const exists = state.clients.some((c) => c.clientId === client.clientId);
  if (exists) {
    const errorMsg = `Client already registered: ${client.clientId}`;
    return {
      nextState: transitionState(state, { appendError: buildError(SOURCE, errorMsg) }),
      output: Object.freeze({ success: false, error: "client_exists", logs: Object.freeze([buildError(SOURCE, errorMsg)]) }),
    };
  }

  const log = buildLog(SOURCE, `Client registered: ${client.clientId}`);
  return {
    nextState: transitionState(state, {
      clients: [...state.clients, newClient],
      appendLog: log,
    }),
    output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
  };
}
