/**
 * server/hallucination/fake-dependency-detector.ts
 * Detects when LLM references packages not in package.json or node_modules.
 * Single responsibility: detect fake deps. Read-only, no side effects.
 */

import fs   from "fs/promises";
import path from "path";
import type { HallucinationSignal } from "./types.ts";

const PKG_JSON = path.join(process.cwd(), "package.json");

async function getInstalledPackages(): Promise<Set<string>> {
  try {
    const raw  = await fs.readFile(PKG_JSON, "utf8");
    const pkg  = JSON.parse(raw) as Record<string, unknown>;
    const deps = {
      ...(pkg.dependencies as Record<string, string> ?? {}),
      ...(pkg.devDependencies as Record<string, string> ?? {}),
    };
    return new Set(Object.keys(deps));
  } catch {
    return new Set();
  }
}

// Extract npm package names from import statements in content
function extractImports(content: string): string[] {
  const matches = content.matchAll(/(?:from|import|require)\s+['"]([^'"./][^'"]*)['"]/g);
  return [...matches].map(m => {
    const name = m[1]!;
    // Normalize: scoped = @org/pkg, else first segment
    return name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name.split("/")[0]!;
  });
}

export async function detectFakeDependencies(
  proposedCode: string,
): Promise<HallucinationSignal[]> {
  if (!proposedCode) return [];

  const installed = await getInstalledPackages();
  const referenced = extractImports(proposedCode);
  const signals: HallucinationSignal[] = [];

  for (const pkg of new Set(referenced)) {
    // Skip Node built-ins and relative imports
    if (!pkg || pkg.startsWith(".")) continue;
    const isBuiltin = ["fs", "path", "os", "http", "https", "crypto", "events",
      "stream", "util", "url", "child_process", "buffer", "net"].includes(pkg);
    if (isBuiltin) continue;

    if (!installed.has(pkg)) {
      signals.push({
        type:       "fake_dependency",
        confidence: 0.75,
        evidence:   `Package "${pkg}" is not in package.json`,
        location:   pkg,
      });
    }
  }

  return signals;
}
