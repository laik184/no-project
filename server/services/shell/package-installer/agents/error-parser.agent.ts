import type { ErrorDetails } from "../types.js";

export function parseInstallError(stderr: string, timedOut = false): Readonly<ErrorDetails> {
  if (timedOut) {
    return Object.freeze({
      type: "TIMEOUT",
      message: "Package operation timed out",
      suggestion: "Increase timeoutMs and retry.",
    });
  }

  const normalized = stderr.toLowerCase();

  if (/(econnreset|etimedout|enotfound|network)/.test(normalized)) {
    return Object.freeze({
      type: "NETWORK",
      message: "Network error while communicating with package registry",
      suggestion: "Check internet/proxy settings and retry.",
    });
  }

  if (/(eresolve|peer dep|conflict|unable to resolve dependency tree)/.test(normalized)) {
    return Object.freeze({
      type: "VERSION_CONFLICT",
      message: "Dependency version conflict detected",
      suggestion: "Pin compatible versions or rerun with compatible ranges.",
    });
  }

  if (/(eacces|permission denied)/.test(normalized)) {
    return Object.freeze({
      type: "PERMISSION",
      message: "Permission error during package operation",
      suggestion: "Check folder/file permissions and retry.",
    });
  }

  return Object.freeze({
    type: "UNKNOWN",
    message: "Unknown package manager error",
    suggestion: "Inspect stderr logs for details.",
  });
}
