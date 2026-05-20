import { orchestrateInstall, orchestrateRemove, orchestrateUpdate } from "./orchestrator.js";
import type { PackageInstallInput, PackageInstallResult } from "./types.js";

export async function installPackages(input: Readonly<PackageInstallInput>): Promise<Readonly<PackageInstallResult>> {
  return orchestrateInstall(input);
}

export async function updatePackages(input: Readonly<PackageInstallInput>): Promise<Readonly<PackageInstallResult>> {
  return orchestrateUpdate(input);
}

export async function removePackages(input: Readonly<PackageInstallInput>): Promise<Readonly<PackageInstallResult>> {
  return orchestrateRemove(input);
}

export type {
  ErrorDetails,
  InstallOptions,
  PackageInstallInput,
  PackageInstallResult,
  PackageManager,
} from "./types.js";
