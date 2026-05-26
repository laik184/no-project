import {
  Brain, FileText, FileCode, Trash2, Terminal, Package, Server,
  RefreshCw, Database, GitBranch, Globe, Camera, Monitor, Eye,
  ScrollText, Zap, Link, Lock, Bug, FlaskConical, Activity,
  Search, Key, FilePlus, TerminalSquare, GitCommit, ShieldCheck,
  FileSearch, Replace, StopCircle,
} from "lucide-react";

export type AnimationStyle = "spin" | "pulse" | "bounce" | "flash" | "ping" | "shake";

export const TOOL_ICON_MAP: Record<string, React.ElementType> = {
  // virtual (thinking state — not a real backend tool)
  "analysis.think":          Brain,

  // File tools
  "file_list":               FileText,
  "file_read":               FileText,
  "file_write":              FileCode,
  "file_delete":             Trash2,
  "file_search":             FileSearch,
  "file_replace":            Replace,

  // Shell
  "shell_exec":              TerminalSquare,

  // Package
  "package_install":         Package,
  "package_uninstall":       Package,
  "detect_missing_packages": Package,

  // Server lifecycle
  "server_start":            Server,
  "server_stop":             StopCircle,
  "server_restart":          RefreshCw,
  "server_logs":             ScrollText,

  // Preview / Screenshot
  "preview_url":             Eye,
  "preview_screenshot":      Camera,

  // Env / Secrets
  "env_read":                Key,
  "env_write":               Key,

  // Git
  "git_status":              GitBranch,
  "git_add":                 GitBranch,
  "git_commit":              GitCommit,
  "git_clone":               GitBranch,
  "git_push":                GitBranch,
  "git_pull":                GitBranch,

  // DB
  "db_push":                 Database,
  "db_migrate":              Database,

  // Deploy
  "deploy_publish":          Globe,

  // Test / Debug
  "test_run":                FlaskConical,
  "debug_run":               Bug,
  "monitor_check":           Activity,

  // Browser
  "browser_eval":            Monitor,

  // Network
  "api_call":                Link,
  "search_web":              Search,

  // Auth
  "auth_login":              Lock,

  // Security
  "package_audit":           ShieldCheck,

  // Agent control
  "task_complete":           Zap,
  "agent_message":           Brain,
  "agent_question":          Brain,
};

export const TOOL_COLOR_MAP: Record<string, string> = {
  "analysis.think":          "#a78bfa",

  "file_list":               "#7dd3fc",
  "file_read":               "#7dd3fc",
  "file_write":              "#86efac",
  "file_delete":             "#f87171",
  "file_search":             "#22d3ee",
  "file_replace":            "#86efac",

  "shell_exec":              "#fbbf24",

  "package_install":         "#fb923c",
  "package_uninstall":       "#fb923c",
  "detect_missing_packages": "#fb923c",

  "server_start":            "#4ade80",
  "server_stop":             "#f87171",
  "server_restart":          "#fb923c",
  "server_logs":             "#94a3b8",

  "preview_url":             "#f472b6",
  "preview_screenshot":      "#f472b6",

  "env_read":                "#facc15",
  "env_write":               "#fbbf24",

  "git_status":              "#86efac",
  "git_add":                 "#86efac",
  "git_commit":              "#86efac",
  "git_clone":               "#86efac",
  "git_push":                "#4ade80",
  "git_pull":                "#4ade80",

  "db_push":                 "#34d399",
  "db_migrate":              "#34d399",

  "deploy_publish":          "#60a5fa",

  "test_run":                "#34d399",
  "debug_run":               "#f87171",
  "monitor_check":           "#a78bfa",

  "browser_eval":            "#c084fc",
  "api_call":                "#38bdf8",
  "search_web":              "#f97316",
  "auth_login":              "#facc15",
  "package_audit":           "#818cf8",

  "task_complete":           "#4ade80",
  "agent_message":           "#a78bfa",
  "agent_question":          "#a78bfa",
};

export const TOOL_EMOJI_MAP: Record<string, string> = {
  "analysis.think":          "🧠",

  "file_list":               "📁",
  "file_read":               "📖",
  "file_write":              "✍️",
  "file_delete":             "🗑️",
  "file_search":             "🔎",
  "file_replace":            "✏️",

  "shell_exec":              "⚡",

  "package_install":         "📦",
  "package_uninstall":       "📦",
  "detect_missing_packages": "🔍",

  "server_start":            "🟢",
  "server_stop":             "🔴",
  "server_restart":          "🔄",
  "server_logs":             "📜",

  "preview_url":             "👁️",
  "preview_screenshot":      "📸",

  "env_read":                "🔑",
  "env_write":               "🔑",

  "git_status":              "🌿",
  "git_add":                 "➕",
  "git_commit":              "💾",
  "git_clone":               "📥",
  "git_push":                "⬆️",
  "git_pull":                "⬇️",

  "db_push":                 "🗄️",
  "db_migrate":              "🗄️",

  "deploy_publish":          "🚀",

  "test_run":                "🧪",
  "debug_run":               "🐛",
  "monitor_check":           "📊",

  "browser_eval":            "🖥️",
  "api_call":                "🔗",
  "search_web":              "🌐",
  "auth_login":              "🔐",
  "package_audit":           "🛡️",

  "task_complete":           "✅",
  "agent_message":           "💬",
  "agent_question":          "❓",
};

export const TOOL_ANIMATION_MAP: Record<string, AnimationStyle> = {
  "analysis.think":          "pulse",

  "file_list":               "bounce",
  "file_read":               "bounce",
  "file_write":              "bounce",
  "file_delete":             "shake",
  "file_search":             "spin",
  "file_replace":            "bounce",

  "shell_exec":              "flash",

  "package_install":         "spin",
  "package_uninstall":       "spin",
  "detect_missing_packages": "spin",

  "server_start":            "pulse",
  "server_stop":             "flash",
  "server_restart":          "spin",
  "server_logs":             "pulse",

  "preview_url":             "flash",
  "preview_screenshot":      "flash",

  "env_read":                "flash",
  "env_write":               "flash",

  "git_status":              "pulse",
  "git_add":                 "bounce",
  "git_commit":              "pulse",
  "git_clone":               "spin",
  "git_push":                "bounce",
  "git_pull":                "bounce",

  "db_push":                 "ping",
  "db_migrate":              "ping",

  "deploy_publish":          "bounce",

  "test_run":                "ping",
  "debug_run":               "shake",
  "monitor_check":           "pulse",

  "browser_eval":            "pulse",
  "api_call":                "ping",
  "search_web":              "spin",
  "auth_login":              "pulse",
  "package_audit":           "spin",

  "task_complete":           "pulse",
  "agent_message":           "pulse",
  "agent_question":          "pulse",
};
