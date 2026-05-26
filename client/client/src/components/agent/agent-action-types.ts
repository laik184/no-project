export type ToolName =
  | "analysis.think"
  | "file.read" | "file.write" | "file.delete" | "file.create"
  | "console.run" | "shell.exec"
  | "package.install" | "package.remove"
  | "server.start" | "server.restart"
  | "db.push" | "db.migrate"
  | "git.clone" | "git.commit"
  | "deploy.publish"
  | "screenshot.capture"
  | "ui.render"
  | "preview.open"
  | "logs.stream"
  | "api.call"
  | "auth.login"
  | "webhook.trigger"
  | "search.web" | "search.code"
  | "env.read" | "env.write"
  | "debug.run" | "test.run" | "monitor.check";

export type StreamItemType = "message" | "action_group" | "action" | "result" | "state";
export type ActionStatus = "pending" | "running" | "done";

export interface AgentStreamItem {
  type: StreamItemType;
  content: string;
  tool?: ToolName;
  status?: ActionStatus;
  icon?: string;
  group_id?: string;
  meta?: {
    duration?: string;
    progress?: number;
    logs?: string;
    file?: string;
  };
}

export type AgentActionDef = AgentStreamItem;

export const TOOL_META: Record<ToolName, { emoji: string; label: string; color: string }> = {
  "analysis.think":    { emoji: "🧠", label: "analysis.think",    color: "#a78bfa" },
  "file.read":         { emoji: "📁", label: "file.read",         color: "#7dd3fc" },
  "file.write":        { emoji: "📁", label: "file.write",        color: "#86efac" },
  "file.delete":       { emoji: "📁", label: "file.delete",       color: "#f87171" },
  "console.run":       { emoji: "💻", label: "console.run",       color: "#fbbf24" },
  "package.install":   { emoji: "📦", label: "package.install",   color: "#fb923c" },
  "package.remove":    { emoji: "📦", label: "package.remove",    color: "#fb923c" },
  "server.start":      { emoji: "🟢", label: "server.start",      color: "#4ade80" },
  "server.restart":    { emoji: "🔄", label: "server.restart",    color: "#fb923c" },
  "db.push":           { emoji: "🗄️", label: "db.push",           color: "#34d399" },
  "db.migrate":        { emoji: "🗄️", label: "db.migrate",        color: "#34d399" },
  "git.clone":         { emoji: "🌿", label: "git.clone",         color: "#86efac" },
  "git.commit":        { emoji: "🌿", label: "git.commit",        color: "#86efac" },
  "deploy.publish":    { emoji: "🚀", label: "deploy.publish",    color: "#60a5fa" },
  "screenshot.capture":{ emoji: "📸", label: "screenshot.capture",color: "#f472b6" },
  "ui.render":         { emoji: "🖥️", label: "ui.render",         color: "#c084fc" },
  "preview.open":      { emoji: "👁️", label: "preview.open",      color: "#f472b6" },
  "logs.stream":       { emoji: "📜", label: "logs.stream",       color: "#94a3b8" },
  "api.call":          { emoji: "🔗", label: "api.call",          color: "#38bdf8" },
  "auth.login":        { emoji: "🔐", label: "auth.login",        color: "#facc15" },
  "webhook.trigger":   { emoji: "📡", label: "webhook.trigger",   color: "#818cf8" },
  "search.web":        { emoji: "🔍", label: "search.web",        color: "#f97316" },
  "search.code":       { emoji: "🔎", label: "search.code",       color: "#22d3ee" },
  "env.read":          { emoji: "🔑", label: "env.read",          color: "#facc15" },
  "env.write":         { emoji: "🔑", label: "env.write",         color: "#fbbf24" },
  "shell.exec":        { emoji: "⚡", label: "shell.exec",        color: "#a3e635" },
  "file.create":       { emoji: "📄", label: "file.create",       color: "#86efac" },
  "debug.run":         { emoji: "🐛", label: "debug.run",         color: "#f87171" },
  "test.run":          { emoji: "🧪", label: "test.run",          color: "#34d399" },
  "monitor.check":     { emoji: "📊", label: "monitor.check",     color: "#a78bfa" },
};
