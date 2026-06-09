import {
  Eye, Database, Terminal, Globe, GitBranch, Camera, MonitorPlay,
  Layers, Shield, HardDrive, UserCheck,
} from "lucide-react";

export const toolItems = [
  { id: "preview",      label: "Preview",         sub: "Live preview of your app in real time",                              icon: Eye,         color: "#60a5fa", bg: "rgba(96,165,250,0.12)",   url: "/preview"        },
  { id: "publishing",   label: "Publishing",      sub: "Publish a live, stable, public version of your app",                icon: Globe,       color: "#4ade80", bg: "rgba(74,222,128,0.12)",   url: "__publishing__"  },
  { id: "integrations", label: "Integrations",    sub: "Connect to external services and APIs",                             icon: Layers,      color: "#a78bfa", bg: "rgba(167,139,250,0.12)",  url: "__integrations__"},
  { id: "database",     label: "Database",        sub: "Stores structured data such as user profiles, game scores, and product catalogs", icon: Database, color: "#34d399", bg: "rgba(52,211,153,0.12)", url: "__database__" },
  { id: "storage",      label: "App Storage",     sub: "Host and save uploads like images, videos, and documents",          icon: HardDrive,   color: "#fb923c", bg: "rgba(251,146,60,0.12)",   url: "__storage__"     },
  { id: "auth",         label: "Auth",            sub: "Let users log in to your App using a prebuilt login page",          icon: UserCheck,   color: "#f472b6", bg: "rgba(244,114,182,0.12)",  url: "__auth__"        },
  { id: "security",     label: "Security Center", sub: "Review permissions, secrets, and vulnerability alerts",             icon: Shield,      color: "#fbbf24", bg: "rgba(251,191,36,0.12)",   url: "__checkpoints__" },
  { id: "console",      label: "Terminal",        sub: "Run commands and view server logs",                                 icon: Terminal,    color: "#fbbf24", bg: "rgba(251,191,36,0.12)",   url: "__console__"     },
  { id: "git",          label: "Git",             sub: "Version history, branches, and commits",                            icon: GitBranch,   color: "#86efac", bg: "rgba(134,239,172,0.12)",  url: "__git__"         },
  { id: "checkpoints",  label: "Checkpoints",     sub: "Browse history, compare snapshots, and one-click restore",         icon: Camera,      color: "#fbbf24", bg: "rgba(251,191,36,0.12)",   url: "__checkpoints__" },
  { id: "browser",      label: "Browser Agent",   sub: "Live Playwright session status, screenshots, and validation",      icon: MonitorPlay, color: "#60a5fa", bg: "rgba(96,165,250,0.12)",   url: "__browser__"     },
];
