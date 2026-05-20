export function parsePackageNamesFromOutput(output: string): readonly string[] {
  const found = new Set<string>();
  const tokenPattern = /(?:^|\s)([@a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)?)(?:@[^\s]+)?/g;

  for (const line of output.split(/\r?\n/)) {
    if (!/(added|removed|updated|upgraded|install|dependencies)/i.test(line)) continue;

    for (const match of line.matchAll(tokenPattern)) {
      const candidate = match[1]?.trim();
      if (!candidate) continue;
      if (candidate.startsWith("--")) continue;
      if (["added", "removed", "updated", "upgraded", "dependencies", "dependency", "install"].includes(candidate.toLowerCase())) continue;
      found.add(candidate);
    }
  }

  return Object.freeze([...found]);
}
