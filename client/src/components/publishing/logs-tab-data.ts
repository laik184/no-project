export type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
export type LogFilter = "ALL" | LogLevel;

export interface LogEntry {
  id: number;
  ts: string;
  level: LogLevel;
  message: string;
}

export const LEVEL_STYLE: Record<LogLevel, { badge: string; badgeBg: string; text: string }> = {
  INFO:    { badge: "#94a3b8", badgeBg: "rgba(148,163,184,0.1)", text: "rgba(148,163,184,0.8)"  },
  SUCCESS: { badge: "#4ade80", badgeBg: "rgba(74,222,128,0.1)",  text: "rgba(134,239,172,0.9)"  },
  WARNING: { badge: "#fbbf24", badgeBg: "rgba(251,191,36,0.1)",  text: "rgba(253,224,71,0.85)"  },
  ERROR:   { badge: "#f87171", badgeBg: "rgba(248,113,113,0.1)", text: "rgba(252,165,165,0.9)"  },
};

function makeTs(base: Date, offsetSec: number) {
  const d = new Date(base.getTime() + offsetSec * 1000);
  return d.toTimeString().slice(0, 8);
}

const BASE = new Date();
BASE.setHours(12, 45, 0, 0);

export const SEED_LOGS: LogEntry[] = [
  { id:  1, ts: makeTs(BASE,  0), level: "INFO",    message: "Starting deployment pipeline..." },
  { id:  2, ts: makeTs(BASE,  1), level: "INFO",    message: "Allocating compute resources..." },
  { id:  3, ts: makeTs(BASE,  2), level: "SUCCESS", message: "Resources provisioned successfully." },
  { id:  4, ts: makeTs(BASE,  3), level: "INFO",    message: "Running security scan on dependencies..." },
  { id:  5, ts: makeTs(BASE,  5), level: "WARNING", message: "lodash@4.17.20 has 1 low-severity advisory." },
  { id:  6, ts: makeTs(BASE,  6), level: "SUCCESS", message: "Security scan passed. No critical issues found." },
  { id:  7, ts: makeTs(BASE,  7), level: "INFO",    message: "Installing dependencies (npm ci)..." },
  { id:  8, ts: makeTs(BASE,  9), level: "INFO",    message: "Running build script: npm run build" },
  { id:  9, ts: makeTs(BASE, 11), level: "INFO",    message: "Compiling TypeScript..." },
  { id: 10, ts: makeTs(BASE, 13), level: "INFO",    message: "Optimizing and minifying assets..." },
  { id: 11, ts: makeTs(BASE, 15), level: "SUCCESS", message: "Build completed in 12.4s  (847KB → 213KB gzipped)" },
  { id: 12, ts: makeTs(BASE, 16), level: "INFO",    message: "Bundling assets for production..." },
  { id: 13, ts: makeTs(BASE, 17), level: "INFO",    message: "Generating source maps..." },
  { id: 14, ts: makeTs(BASE, 18), level: "SUCCESS", message: "Bundle ready. Output: dist/" },
  { id: 15, ts: makeTs(BASE, 19), level: "INFO",    message: "Pushing image to container registry..." },
  { id: 16, ts: makeTs(BASE, 21), level: "INFO",    message: "Routing traffic to new deployment..." },
  { id: 17, ts: makeTs(BASE, 22), level: "INFO",    message: "Running health checks on /health..." },
  { id: 18, ts: makeTs(BASE, 23), level: "ERROR",   message: "Health check failed: connection refused on port 3000." },
  { id: 19, ts: makeTs(BASE, 24), level: "WARNING", message: "Retrying health check (attempt 2 of 3)..." },
  { id: 20, ts: makeTs(BASE, 25), level: "SUCCESS", message: "Health check passed. Service is healthy." },
  { id: 21, ts: makeTs(BASE, 26), level: "SUCCESS", message: "Deployment promoted to production. App is live 🚀" },
];
