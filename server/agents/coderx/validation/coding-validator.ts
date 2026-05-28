/**
 * server/agents/coderx/validation/coding-validator.ts
 *
 * Validates coding requests, routed steps, and execution state.
 * Throws on invalid input — never silently swallows errors.
 */

import type { CodingRequest, RoutedCodingStep } from '../types/coderx.types.ts';

export class CodingValidationError extends Error {
  constructor(message: string) {
    super(`[coding-validator] ${message}`);
    this.name = 'CodingValidationError';
  }
}

// ── Request validation ────────────────────────────────────────────────────────

export function assertValidCodingRequest(request: CodingRequest): void {
  if (!request.requestId?.trim()) {
    throw new CodingValidationError('requestId is required and must not be empty.');
  }
  if (!request.runId?.trim()) {
    throw new CodingValidationError('runId is required and must not be empty.');
  }
  if (!request.projectId?.trim()) {
    throw new CodingValidationError('projectId is required and must not be empty.');
  }
  if (!request.sandboxRoot?.trim()) {
    throw new CodingValidationError('sandboxRoot is required and must not be empty.');
  }
  if (!request.userPrompt?.trim()) {
    throw new CodingValidationError('userPrompt is required and must not be empty.');
  }
  if (request.userPrompt.trim().length < 5) {
    throw new CodingValidationError('userPrompt is too short — minimum 5 characters.');
  }
}

// ── Routed step validation ────────────────────────────────────────────────────

export function assertRoutedCodingStep(step: RoutedCodingStep): void {
  if (!step.toolName?.trim()) {
    throw new CodingValidationError('RoutedCodingStep.toolName is required.');
  }
  if (typeof step.toolInput !== 'object' || step.toolInput === null) {
    throw new CodingValidationError('RoutedCodingStep.toolInput must be a plain object.');
  }
}

// ── Loop options validation ───────────────────────────────────────────────────

export function assertValidRetryConfig(config: {
  maxAttempts: number;
  delayMs:     number;
  backoff:     string;
}): void {
  if (!Number.isInteger(config.maxAttempts) || config.maxAttempts < 1) {
    throw new CodingValidationError('retryConfig.maxAttempts must be a positive integer.');
  }
  if (typeof config.delayMs !== 'number' || config.delayMs < 0) {
    throw new CodingValidationError('retryConfig.delayMs must be a non-negative number.');
  }
  const validBackoffs = ['none', 'linear', 'exponential'];
  if (!validBackoffs.includes(config.backoff)) {
    throw new CodingValidationError(
      `retryConfig.backoff must be one of: ${validBackoffs.join(', ')}.`,
    );
  }
}

// ── State validation ──────────────────────────────────────────────────────────

export function assertValidSessionId(sessionId: string | undefined): void {
  if (!sessionId?.trim()) {
    throw new CodingValidationError('sessionId is required and must not be empty.');
  }
}
