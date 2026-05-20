function walk(nodes: readonly { path: string; type: "file" | "directory"; children?: readonly unknown[] }[]): string[] {
  const paths: string[] = [];

  for (const node of nodes) {
    paths.push(node.path);

    if (node.type === "directory" && Array.isArray(node.children)) {
      paths.push(...walk(node.children as readonly { path: string; type: "file" | "directory"; children?: readonly unknown[] }[]));
    }
  }

  return paths;
}

export function flattenStructure(
  projectStructure: readonly { path: string; type: "file" | "directory"; children?: readonly unknown[] }[],
): string[] {
  return walk(projectStructure);
}

export function countByKeyword(paths: readonly string[], keyword: string): number {
  return paths.filter((path) => path.toLowerCase().includes(keyword.toLowerCase())).length;
}

export function maxPathDepth(paths: readonly string[]): number {
  if (paths.length === 0) {
    return 0;
  }

  return Math.max(...paths.map((path) => path.split("/").filter(Boolean).length));
}

export function groupByTopLevel(paths: readonly string[]): Record<string, number> {
  const groups: Record<string, number> = {};

  for (const path of paths) {
    const top = path.split("/").filter(Boolean)[0] ?? "root";
    groups[top] = (groups[top] ?? 0) + 1;
  }

  return groups;
}
