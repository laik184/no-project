import { join } from "node:path";

import type { PackageManager } from "../types.js";
import { fileSystemService } from "../../../../../../services/index.js";

export async function detectPackageManager(projectPath: string): Promise<PackageManager> {
  if (await fileSystemService.exists(join(projectPath, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileSystemService.exists(join(projectPath, "yarn.lock"))) return "yarn";
  if (await fileSystemService.exists(join(projectPath, "package-lock.json"))) return "npm";
  return "npm";
}
