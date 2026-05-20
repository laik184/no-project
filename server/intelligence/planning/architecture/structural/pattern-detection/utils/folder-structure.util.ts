function topLevelSegment(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  const [first, second] = normalized.split("/");
  if (!first) return "root";
  if (["src", "server", "app", "services", "modules", "packages"].includes(first) && second) {
    return second;
  }
  return first;
}

export function extractModules(files: readonly string[]): readonly string[] {
  const modules = new Set<string>();
  for (const file of files) {
    modules.add(topLevelSegment(file));
  }
  return Object.freeze(Array.from(modules).sort((a, b) => a.localeCompare(b)));
}

export function groupFilesByModule(files: readonly string[]): Readonly<Record<string, readonly string[]>> {
  const grouped: Record<string, string[]> = {};
  for (const file of files) {
    const module = topLevelSegment(file);
    grouped[module] ??= [];
    grouped[module].push(file);
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(grouped)
        .map(([module, moduleFiles]): [string, readonly string[]] => [
          module,
          Object.freeze([...moduleFiles].sort((a, b) => a.localeCompare(b))),
        ])
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
