export type Tab = "overview" | "logs" | "resources" | "domains" | "manage";

export const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Overview"  },
  { id: "logs",      label: "Logs"      },
  { id: "resources", label: "Resources" },
  { id: "domains",   label: "Domains"   },
  { id: "manage",    label: "Manage"    },
];

export const MOCK_DOMAIN = "nura-x-app.replit.app";

export type DeployStatus = "failed" | "success" | "processing";

export const STATUS_CONFIG: Record<DeployStatus, { dot: string; glow: string; label: string }> = {
  failed:     { dot: "#f87171", glow: "rgba(248,113,113,0.4)", label: "Failed to publish" },
  success:    { dot: "#4ade80", glow: "rgba(74,222,128,0.4)",  label: "Live"              },
  processing: { dot: "#fbbf24", glow: "rgba(251,191,36,0.4)",  label: "Deploying…"        },
};

export function StatusDot({ status }: { status: DeployStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.glow}` }}
    />
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="text-[12px] font-medium" style={{ color: "rgba(148,163,184,0.7)" }}>{label}</span>
      <div className="flex items-center gap-2 text-[13px]" style={{ color: "rgba(226,232,240,0.9)" }}>
        {children}
      </div>
    </div>
  );
}

export type StepState = "pending" | "running" | "success" | "error";

export interface DeployStep {
  id: string;
  label: string;
  message: string;
  logs: string[];
  duration: number;
}

export const DEPLOY_STEPS: DeployStep[] = [
  {
    id: "provision",
    label: "Provision",
    message: "Provisioning resources...",
    logs: [
      "Allocating compute resources...",
      "Setting up container environment...",
      "Configuring network policies...",
      "Resources provisioned successfully.",
    ],
    duration: 1600,
  },
  {
    id: "security",
    label: "Security Scan",
    message: "Running security checks...",
    logs: [
      "Scanning dependencies for vulnerabilities...",
      "Checking for exposed secrets...",
      "Validating SSL/TLS configuration...",
      "Security scan passed. No issues found.",
    ],
    duration: 2200,
  },
  {
    id: "build",
    label: "Build",
    message: "Building your app...",
    logs: [
      "Installing dependencies...",
      "Running npm run build...",
      "Compiling TypeScript...",
      "Optimizing assets...",
      "Build completed in 12.4s.",
    ],
    duration: 2800,
  },
  {
    id: "bundle",
    label: "Bundle",
    message: "Bundling assets...",
    logs: [
      "Minifying JavaScript (847KB → 213KB)...",
      "Compressing CSS...",
      "Generating source maps...",
      "Bundle ready.",
    ],
    duration: 1800,
  },
  {
    id: "promote",
    label: "Promote",
    message: "Promoting to production...",
    logs: [
      "Pushing image to registry...",
      "Routing traffic to new deployment...",
      "Running health checks...",
      "Deployment promoted. App is live.",
    ],
    duration: 1200,
  },
];

export interface DeployState {
  active: boolean;
  panelOpen: boolean;
  stepStates: StepState[];
  stepLogs: string[][];
  currentStep: number;
  done: boolean;
  failed: boolean;
  elapsedMs: number;
}

export function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
