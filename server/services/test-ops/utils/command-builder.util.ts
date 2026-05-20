import type { RunnerConfig } from "../types.js";

export interface BuiltCommand {
  readonly command: string;
  readonly args: readonly string[];
}

export function buildTestCommand(config: RunnerConfig, files: readonly string[]): BuiltCommand {
  const framework = config.framework ?? "vitest";
  const coverageEnabled = config.coverage ?? true;

  if (framework === "jest") {
    return Object.freeze({
      command: "npx",
      args: Object.freeze([
        "jest",
        "--json",
        ...(coverageEnabled ? ["--coverage"] : []),
        ...files,
      ]),
    });
  }

  if (framework === "node-test") {
    return Object.freeze({
      command: "node",
      args: Object.freeze([
        "--test",
        ...files,
      ]),
    });
  }

  return Object.freeze({
    command: "npx",
    args: Object.freeze([
      "vitest",
      "run",
      "--reporter=verbose",
      ...(coverageEnabled ? ["--coverage"] : []),
      ...files,
    ]),
  });
}
