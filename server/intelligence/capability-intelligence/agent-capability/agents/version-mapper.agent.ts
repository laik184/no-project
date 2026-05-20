import type { AgentScanResult, MappedVersion, VersionChannel } from "../types.js";
import { classifyChannel } from "../utils/type.util.js";

const SEMVER_PATTERN = /^(\d+)\.(\d+)(?:\.(\d+))?(?:[.-][a-zA-Z0-9._-]*)?$/;
const UNKNOWN_VERSION = "0.0.0" as const;

function parseSemver(
  raw: string,
): { major: number; minor: number; patch: number } | null {
  const clean = raw.trim().replace(/^v/, "");
  const match  = SEMVER_PATTERN.exec(clean);
  if (!match) return null;
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: match[3] ? parseInt(match[3], 10) : 0,
  };
}

function isDeprecated(channel: VersionChannel, major: number): boolean {
  return channel === "deprecated" || major === 0;
}

export function mapVersions(
  scans: readonly AgentScanResult[],
): readonly MappedVersion[] {
  if (!Array.isArray(scans)) return Object.freeze([]);

  return Object.freeze(
    scans.map((scan): MappedVersion => {
      const raw     = scan.rawVersion;
      const parsed  = parseSemver(raw);
      const channel = classifyChannel(raw);

      if (!parsed) {
        return Object.freeze({
          agentId: scan.agentId,
          version: raw.length > 0 ? raw : UNKNOWN_VERSION,
          channel: "stable",
          major:   0,
          minor:   0,
          patch:   0,
          isValid: false,
        });
      }

      const { major, minor, patch } = parsed;
      const resolvedChannel: VersionChannel = isDeprecated(channel, major)
        ? "deprecated"
        : channel;

      return Object.freeze({
        agentId: scan.agentId,
        version: raw,
        channel: resolvedChannel,
        major,
        minor,
        patch,
        isValid: true,
      });
    }),
  );
}

export function latestVersion(
  versions: readonly MappedVersion[],
): MappedVersion | null {
  if (versions.length === 0) return null;
  return versions.reduce((best, v) => {
    if (v.major > best.major) return v;
    if (v.major === best.major && v.minor > best.minor) return v;
    if (v.major === best.major && v.minor === best.minor && v.patch > best.patch) return v;
    return best;
  });
}

export function filterValidVersions(
  versions: readonly MappedVersion[],
): readonly MappedVersion[] {
  return Object.freeze(versions.filter((v) => v.isValid));
}
