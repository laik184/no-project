export interface SessionSnapshot {
  sessionId:  string;
  runId:      string;
  projectId:  number | null;
  status:     string;
  pagesOpen:  number;
  launchedAt: string | null;
  closedAt:   string | null;
}

export interface SessionState extends SessionSnapshot {
  screenshots: Array<{ label: string; path: string; url: string; ts: string }>;
  consoleErrors: number;
  lastValidation?: "passed" | "failed";
  lastUrl?: string;
  lastError?: string;
  events: Array<{ type: string; ts: string; label?: string }>;
}

export interface BrowserSessionEvent {
  type:            string;
  sessionId:       string;
  runId:           string;
  projectId?:      number;
  label?:          string;
  screenshotPath?: string;
  error?:          string;
  url?:            string;
  timestamp:       string;
}

export interface SessionsResponse {
  ok:       boolean;
  count:    number;
  active:   number;
  sessions: SessionSnapshot[];
}

export const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  launching:   { label: "Launching",  dot: "#fbbf24", badge: "rgba(251,191,36,0.14)" },
  ready:       { label: "Ready",      dot: "#34d399", badge: "rgba(52,211,153,0.14)" },
  navigating:  { label: "Navigating", dot: "#60a5fa", badge: "rgba(96,165,250,0.14)" },
  capturing:   { label: "Capturing",  dot: "#a78bfa", badge: "rgba(167,139,250,0.14)" },
  validating:  { label: "Validating", dot: "#fbbf24", badge: "rgba(251,191,36,0.14)" },
  closing:     { label: "Closing",    dot: "#94a3b8", badge: "rgba(148,163,184,0.12)" },
  closed:      { label: "Closed",     dot: "#475569", badge: "rgba(71,85,105,0.14)" },
  crashed:     { label: "Crashed",    dot: "#f87171", badge: "rgba(248,113,113,0.14)" },
};

export function elapsed(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s`;
  const m  = Math.floor(s / 60);
  if (m < 60)  return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}
