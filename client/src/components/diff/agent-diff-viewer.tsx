import React, { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { toastError, toastSuccess } from "@/lib/app-error";

type AgentEvent = {
  id?:   string;
  type?: string;
  msg?:  string;
  time?: number;
  diff?: {
    path:      string;
    original:  string;
    proposed:  string;
    changed?:  boolean;
  };
  [key: string]: any;
};

export default function AgentDiffViewer({ events }: { events: AgentEvent[] }) {
  const [dismissIndex, setDismissIndex] = useState<number>(-1);
  const { toast } = useToast();

  const latest = useMemo(() => {
    if (!events || events.length === 0) return null;
    const diffs = events.filter((e) => e.type === "diff" && e.diff && e.diff.changed);
    if (!diffs.length) return null;
    const idx = diffs.length - 1;
    if (idx <= dismissIndex) return null;
    return { diff: diffs[idx].diff, idx };
  }, [events, dismissIndex]);

  if (!latest || !latest.diff) {
    return (
      <div style={{
        marginTop: 12, padding: 8, borderRadius: 6,
        border: "1px solid #1f2937", background: "#020617",
        color: "#9ca3af", fontSize: 12,
      }}>
        No pending AI changes. Run the agent to see file diffs here.
      </div>
    );
  }

  const { diff, idx } = latest;
  const original = diff!.original || "";
  const proposed = diff!.proposed || "";
  const filePath = diff!.path || "";

  async function applyDiff() {
    try {
      const res = await fetch("/api/agent/diff-queue/apply", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ runId: null, files: [{ path: filePath, content: proposed }] }),
      });

      if (!res.ok) {
        const text = await res.text();
        toastError(toast, text || "Apply request failed", "Apply Failed");
        return;
      }

      if (typeof window !== "undefined") {
        try { window.dispatchEvent(new CustomEvent("file-saved", { detail: { path: filePath } })); }
        catch { window.dispatchEvent(new Event("file-saved")); }
        window.dispatchEvent(new Event("file-refresh"));
      }

      toastSuccess(toast, "Changes Applied", `AI diff applied to ${filePath}`);
      setDismissIndex(idx);
    } catch (e) {
      toastError(toast, e, "Apply Failed");
    }
  }

  const rejectDiff = () => setDismissIndex(idx);

  return (
    <div style={{
      marginTop: 12, padding: 8, borderRadius: 6,
      border: "1px solid #1f2937", background: "#020617",
      color: "#e5e7eb", fontSize: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6, gap: 8 }}>
        <span style={{
          fontSize: 11, padding: "2px 6px", borderRadius: 999,
          background: "#1d4ed833", color: "#60a5fa",
          textTransform: "uppercase", letterSpacing: 0.08,
        }}>AI Diff</span>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{filePath}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={rejectDiff} style={{
            padding: "2px 8px", fontSize: 11, borderRadius: 6,
            border: "1px solid #4b5563", background: "#020617",
            color: "#e5e7eb", cursor: "pointer",
          }}>Reject</button>
          <button onClick={applyDiff} style={{
            padding: "2px 8px", fontSize: 11, borderRadius: 6,
            border: "1px solid #22c55e", background: "#16a34a",
            color: "#f9fafb", cursor: "pointer",
          }}>Apply</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
        {[["Original", original], ["Proposed", proposed]].map(([label, content]) => (
          <div key={label}>
            <div style={{ marginBottom: 4, color: "#9ca3af", textTransform: "uppercase" }}>{label}</div>
            <pre style={{
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              background: "#020617", border: "1px solid #1f2937",
              borderRadius: 4, padding: 6, maxHeight: 200, overflow: "auto",
            }}>{content}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
