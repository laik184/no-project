import { join } from "node:path";
import { fileSystemService } from "../../../../../../services/index.js";

export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

export async function validateDependencies(projectPath: string, packages: readonly string[]): Promise<ValidationResult> {
  const packageJsonPath = join(projectPath, "package.json");

  let packageJsonRaw: string;
  try {
    packageJsonRaw = await fileSystemService.readFile(packageJsonPath, "utf8");
  } catch {
    return Object.freeze({ valid: false, error: "package.json was not found" });
  }

  try {
    JSON.parse(packageJsonRaw) as Record<string, unknown>;
  } catch {
    return Object.freeze({ valid: false, error: "package.json is not valid JSON" });
  }

  const deduped = new Set(packages);
  if (deduped.size !== packages.length) {
    return Object.freeze({ valid: false, error: "Duplicate packages are not allowed" });
  }

  return Object.freeze({ valid: true });
}
