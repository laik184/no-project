import { createHash } from "crypto";

export function sha256Short(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function anonymizeIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  const v6Parts = ip.split(":");
  if (v6Parts.length > 2) {
    return v6Parts.slice(0, 4).join(":") + "::/64";
  }
  return sha256Short(ip);
}
