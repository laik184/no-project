import { Eye, Database, Terminal, Globe, GitBranch, Camera, MonitorPlay } from "lucide-react";

export const toolItems = [
  {
    section: "Your App",
    items: [
      { id: "preview",    label: "Preview",    sub: "Live preview of your app in real time",                      icon: Eye,        color: "#60a5fa", bg: "rgba(96,165,250,0.1)",   url: "/preview"        },
      { id: "database",   label: "Database",   sub: "Manage tables, rows, and run queries",                       icon: Database,   color: "#34d399", bg: "rgba(52,211,153,0.1)",   url: "__database__"    },
      { id: "console",    label: "Console",    sub: "Run commands and view server logs",                          icon: Terminal,   color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   url: "__console__"     },
      { id: "git",        label: "Git",        sub: "Version history, branches, and commits",                     icon: GitBranch,  color: "#86efac", bg: "rgba(134,239,172,0.1)",  url: "__git__"         },
    ],
  },
  {
    section: "Deployment",
    items: [
      { id: "publishing", label: "Publishing", sub: "Publish a live, stable, public version of your app",        icon: Globe,      color: "#4ade80", bg: "rgba(74,222,128,0.1)",   url: "__publishing__"  },
    ],
  },
  {
    section: "Safety",
    items: [
      { id: "checkpoints", label: "Checkpoints", sub: "Browse history, compare snapshots, and one-click restore", icon: Camera,    color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   url: "__checkpoints__" },
    ],
  },
  {
    section: "Agent Tools",
    items: [
      { id: "browser",    label: "Browser",    sub: "Live Playwright session status, screenshots, and validation", icon: MonitorPlay, color: "#60a5fa", bg: "rgba(96,165,250,0.1)", url: "__browser__"     },
    ],
  },
];
