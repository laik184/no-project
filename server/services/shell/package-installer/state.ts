import type { InstallerStatus, PackageManager } from "./types.js";

export interface PackageInstallerState {
  readonly manager: PackageManager;
  readonly packages: readonly string[];
  readonly status: InstallerStatus;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

const INITIAL_STATE: Readonly<PackageInstallerState> = Object.freeze({
  manager: "npm",
  packages: Object.freeze([]),
  status: "IDLE",
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});

let internalState: Readonly<PackageInstallerState> = INITIAL_STATE;

function commit(next: PackageInstallerState): void {
  internalState = Object.freeze({
    ...next,
    packages: Object.freeze([...next.packages]),
    logs: Object.freeze([...next.logs]),
    errors: Object.freeze([...next.errors]),
  });
}

export function resetInstallerState(): void {
  internalState = INITIAL_STATE;
}

export function getInstallerState(): Readonly<PackageInstallerState> {
  return internalState;
}

export function setManager(manager: PackageManager): void {
  commit({ ...internalState, manager });
}

export function setPackages(packages: readonly string[]): void {
  commit({ ...internalState, packages: [...packages] });
}

export function setStatus(status: InstallerStatus): void {
  commit({ ...internalState, status });
}

export function appendLog(log: string): void {
  commit({ ...internalState, logs: [...internalState.logs, log] });
}

export function appendError(error: string): void {
  commit({ ...internalState, errors: [...internalState.errors, error] });
}
