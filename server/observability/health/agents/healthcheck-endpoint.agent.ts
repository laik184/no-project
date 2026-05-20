import type { CheckResult, HealthResponse, HealthStatus } from "../types.js";
import { buildCheckResult, httpStatusFromHealth } from "../utils/response-builder.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "healthcheck-endpoint";

export interface EndpointRequest {
  readonly path: string;
  readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
  readonly ip?: string;
}

export interface EndpointResponse {
  readonly statusCode: number;
  readonly body: Readonly<HealthResponse>;
  readonly headers: Readonly<Record<string, string>>;
}

export interface EndpointOptions {
  readonly authToken?: string;
  readonly allowedIps?: readonly string[];
}

function isAuthorized(req: EndpointRequest, options: EndpointOptions): boolean {
  if (!options.authToken && !options.allowedIps?.length) return true;

  if (options.allowedIps?.length && req.ip) {
    if (options.allowedIps.includes(req.ip)) return true;
  }

  if (options.authToken) {
    const authHeader = req.headers?.["authorization"];
    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (token === `Bearer ${options.authToken}`) return true;
  }

  return false;
}

function buildUnauthorizedResponse(): Readonly<EndpointResponse> {
  const body: Readonly<HealthResponse> = Object.freeze({
    success: false,
    status: "DOWN" as HealthStatus,
    checks: Object.freeze([]),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    logs: Object.freeze([]),
    error: "Unauthorized",
  });

  return Object.freeze({
    statusCode: 401,
    body,
    headers: Object.freeze({ "Content-Type": "application/json" }),
  });
}

export function buildHealthEndpointResponse(
  req: EndpointRequest,
  healthResponse: Readonly<HealthResponse>,
  options: EndpointOptions = {},
): Readonly<EndpointResponse> {
  if (!isAuthorized(req, options)) {
    return buildUnauthorizedResponse();
  }

  const statusCode = httpStatusFromHealth(healthResponse.status);

  return Object.freeze({
    statusCode,
    body: healthResponse,
    headers: Object.freeze({
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Health-Status": healthResponse.status,
    }),
  });
}

export function buildLivenessEndpointResponse(
  req: EndpointRequest,
  alive: boolean,
  options: EndpointOptions = {},
): Readonly<EndpointResponse> {
  if (!isAuthorized(req, options)) {
    return buildUnauthorizedResponse();
  }

  const status: HealthStatus = alive ? "HEALTHY" : "DOWN";
  const check: Readonly<CheckResult> = buildCheckResult(
    "liveness",
    alive ? "PASS" : "FAIL",
    alive ? "Service is alive" : "Service is not responding",
    0,
  );

  const body: Readonly<HealthResponse> = Object.freeze({
    success: alive,
    status,
    checks: Object.freeze([check]),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    logs: Object.freeze([buildLog(SOURCE, `Liveness probe: alive=${alive}`)]),
  });

  return Object.freeze({
    statusCode: alive ? 200 : 503,
    body,
    headers: Object.freeze({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Health-Status": status,
    }),
  });
}

export function buildReadinessEndpointResponse(
  req: EndpointRequest,
  healthResponse: Readonly<HealthResponse>,
  options: EndpointOptions = {},
): Readonly<EndpointResponse> {
  if (!isAuthorized(req, options)) {
    return buildUnauthorizedResponse();
  }

  const statusCode = healthResponse.status === "DOWN" ? 503 : 200;

  return Object.freeze({
    statusCode,
    body: healthResponse,
    headers: Object.freeze({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Health-Status": healthResponse.status,
    }),
  });
}
