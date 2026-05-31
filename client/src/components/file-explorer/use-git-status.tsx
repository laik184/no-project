import { useState, useEffect } from "react";

export type GitStatus = "M" | "A" | "D" | "U";

const STATUS_CONFIG: Record<GitStatus, { color: string; title: string }> = {
  M: { color: "#fbbf24", title: "Modified"  },
  A: { color: "#34d399", title: "Added"     },
  D: { color: "#f87171", title: "Deleted"   },
  U: { color: "#6b7280", title: "Untracked" },
};

/** Compact badge shown at the end of file rows. */
export function GitStatusBadge({ status }: { status: GitStatus }) {
  const { color, title } = STATUS_CONFIG[status];
  return (
    <span
      title={title}
      data-testid={`git-status-${status.toLowerCase()}`}
      style={{ fontSize: 9, color, flexShrink: 0, fontWeight: 700, marginLeft: 1 }}
    >
      {status}
    </span>
  );
}

/**
 * Listens for `rfe:git-status` window events.
 * Dispatch with detail = Record<path, GitStatus> to populate.
 * Example:
 *   window.dispatchEvent(new CustomEvent("rfe:git-status", {
 *     detail: { "src/foo.ts": "M", "src/new.ts": "A" }
 *   }))
 */
export function useGitStatus() {
  const [statusMap, setStatusMap] = useState<Map<string, GitStatus>>(new Map());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Record<string, GitStatus>>).detail;
      if (detail && typeof detail === "object") {
        setStatusMap(new Map(Object.entries(detail)));
      }
    };
    window.addEventListener("rfe:git-status", handler);
    return () => window.removeEventListener("rfe:git-status", handler);
  }, []);

  return { statusMap };
}
