/**
 * scripts/kill-port.mjs
 *
 * Kills any process holding the given TCP port.
 * Uses /proc/net/tcp (Linux) — no lsof or fuser required.
 * Usage: node scripts/kill-port.mjs <port>
 */

import { readFileSync, readdirSync, readlinkSync } from 'fs';

const port = parseInt(process.argv[2], 10);
if (!port || isNaN(port)) process.exit(0);

const hexPort = port.toString(16).toUpperCase().padStart(4, '0');

function findInodesForPort(hexPort) {
  const inodes = new Set();
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    try {
      const lines = readFileSync(file, 'utf8').split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        const localPort = parts[1]?.split(':')[1]?.toUpperCase();
        if (localPort === hexPort) {
          inodes.add(parts[9]);
        }
      }
    } catch { /* file may not exist */ }
  }
  return inodes;
}

function findPidsForInodes(inodes) {
  const pids = new Set();
  try {
    for (const entry of readdirSync('/proc')) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const fdDir = `/proc/${entry}/fd`;
        for (const fd of readdirSync(fdDir)) {
          try {
            const link = readlinkSync(`${fdDir}/${fd}`);
            const match = link.match(/socket:\[(\d+)\]/);
            if (match && inodes.has(match[1])) {
              pids.add(parseInt(entry, 10));
            }
          } catch { /* permission denied or fd gone */ }
        }
      } catch { /* process may have exited */ }
    }
  } catch { /* /proc not accessible */ }
  return pids;
}

const inodes = findInodesForPort(hexPort);
if (inodes.size === 0) process.exit(0);

const pids = findPidsForInodes(inodes);
for (const pid of pids) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch { /* already gone */ }
}
