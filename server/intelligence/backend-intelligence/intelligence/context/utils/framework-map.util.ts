import type { ArchitectureStyle, FrameworkName, NormalizedSignals } from "../types.js";

// ── Framework detection ────────────────────────────────────────────────────────

export function pickFramework(signals: NormalizedSignals): FrameworkName {
  const deps = signals.dependencies;

  if (deps.includes("@nestjs/common") || deps.includes("@nestjs/core")) return "NestJS";
  if (deps.includes("django") || deps.includes("djangorestframework"))  return "Django";
  if (
    deps.includes("org.springframework.boot") ||
    deps.includes("spring-boot-starter-web")
  ) return "Spring";

  return "Express";
}

// ── Architecture style detection ───────────────────────────────────────────────

const HEXAGONAL_DOMAIN_MARKER = "domain/";
const HEXAGONAL_PORTS_MARKER  = "ports/";

export function pickArchitectureStyle(
  framework: FrameworkName,
  signals:   NormalizedSignals,
): ArchitectureStyle {
  if (framework === "NestJS" || framework === "Spring") return "Layered";

  if (
    signals.filePaths.some((p) => p.includes(HEXAGONAL_DOMAIN_MARKER)) &&
    signals.filePaths.some((p) => p.includes(HEXAGONAL_PORTS_MARKER))
  ) {
    return "Hexagonal";
  }

  return "MVC";
}
