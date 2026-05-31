import {
  Brain, BookOpen, FileCode, Trash2, Terminal, Package, Server,
  RefreshCw, Database, GitBranch, Rocket, Camera, Monitor, Eye,
  ScrollText, Zap, Link, Lock, Bug, FlaskConical, Activity,
  Search, Key, FilePlus, GitCommit, ShieldCheck,
  FileSearch, Replace, StopCircle,
} from "lucide-react";

export type AnimationStyle = "spin" | "pulse" | "bounce" | "flash" | "ping" | "shake";

export const TOOL_ICON_MAP: Record<string, React.ElementType> = {
  "analysis.think":          Brain,

  "file_list":               BookOpen,
  "file_read":               BookOpen,
  "file_write":              FileCode,
  "file_delete":             Trash2,
  "file_search":             FileSearch,
  "file_replace":            Replace,

  "shell_exec":              Terminal,

  "package_install":         Package,
  "package_uninstall":       Package,
  "detect_missing_packages": Package,

  "server_start":            Server,
  "server_stop":             StopCircle,
  "server_restart":          RefreshCw,
  "server_logs":             ScrollText,

  "preview_url":             Eye,
  "preview_screenshot":      Camera,

  "env_read":                Key,
  "env_write":               Key,

  "git_status":              GitBranch,
  "git_add":                 GitBranch,
  "git_commit":              GitCommit,
  "git_clone":               GitBranch,
  "git_push":                GitBranch,
  "git_pull":                GitBranch,

  "db_push":                 Database,
  "db_migrate":              Database,

  "deploy_publish":          Rocket,

  "test_run":                FlaskConical,
  "debug_run":               Bug,
  "monitor_check":           Activity,

  "browser_eval":            Monitor,

  "api_call":                Link,
  "search_web":              Search,

  "auth_login":              Lock,

  "package_audit":           ShieldCheck,

  "task_complete":           Zap,
  "agent_message":           Brain,
  "agent_question":          Brain,
};

export const TOOL_COLOR_MAP: Record<string, string> = {
  "analysis.think":          "#3b82f6",

  "file_list":               "#7dd3fc",
  "file_read":               "#7dd3fc",
  "file_write":              "#22c55e",
  "file_delete":             "#ef4444",
  "file_search":             "#22d3ee",
  "file_replace":            "#22c55e",

  "shell_exec":              "#f59e0b",

  "package_install":         "#f97316",
  "package_uninstall":       "#f97316",
  "detect_missing_packages": "#f97316",

  "server_start":            "#22c55e",
  "server_stop":             "#ef4444",
  "server_restart":          "#f97316",
  "server_logs":             "#94a3b8",

  "preview_url":             "#a78bfa",
  "preview_screenshot":      "#a78bfa",

  "env_read":                "#f59e0b",
  "env_write":               "#f59e0b",

  "git_status":              "#22c55e",
  "git_add":                 "#22c55e",
  "git_commit":              "#22c55e",
  "git_clone":               "#22c55e",
  "git_push":                "#22c55e",
  "git_pull":                "#22c55e",

  "db_push":                 "#34d399",
  "db_migrate":              "#34d399",

  "deploy_publish":          "#3b82f6",

  "test_run":                "#34d399",
  "debug_run":               "#ef4444",
  "monitor_check":           "#3b82f6",

  "browser_eval":            "#94a3b8",
  "api_call":                "#38bdf8",
  "search_web":              "#f97316",
  "auth_login":              "#f59e0b",
  "package_audit":           "#818cf8",

  "task_complete":           "#22c55e",
  "agent_message":           "#3b82f6",
  "agent_question":          "#3b82f6",
};

export const TOOL_EMOJI_MAP: Record<string, string> = {
  "analysis.think":          "🧠",
  "file_list":               "📖",
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
