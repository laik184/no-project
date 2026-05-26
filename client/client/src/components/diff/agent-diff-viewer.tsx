import React, { useMemo, useState } from "react";

type AgentEvent = {
  id?: string;
  type?: string;
  msg?: string;
  time?: number;
  diff?: {
    path: string;
    original: string;
    proposed: string;
    changed?: boolean;
  };
  [key: string]: any;
};

export default function AgentDiffViewer({ events }: { events: AgentEvent[] }) {
  const [dismissIndex, setDismissIndex] = useState<number>(-1);

  const latest = useMemo(() => {
    if (!events || events.length === 0) return null;
    const diffs = events.filter(
      (e) => e.type === "diff" && e.diff && e.diff.changed
    );
    if (!diffs.length) return null;
    // respect dismissIndex: only show newer diffs
    const idx = diffs.length - 1;
    if (idx <= dismissIndex) return null;
    return { diff: diffs[idx].diff, idx };
  }, [events, dismissIndex]);

  if (!latest || !latest.diff) {
    return (
      <div
        style={{
          marginTop: 12,
          padding: 8,
          borderRadius: 6,
          border: "1px solid #1f2937",
          background: "#020617",
          color: "#9ca3af",
          fontSize: 12,
        }}
      >
        No pending AI changes. Run the agent to see file diffs here.
      </div>
    );
  }

  const { diff, idx } = latest;
  const original = diff.original || "";
  const proposed = diff.proposed || "";
  const path = diff.path || "";

  const applyDiff = async () => {
    try {
      const res = await fetch("/api/agent/diff-queue/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: null,
          files: [
            {
              path,
              content: proposed,
              clientHash: undefined,
            },
          ],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        alert("Apply failed: " + text);
        return;
      }
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(
            new CustomEvent("file-saved", { detail: { path } })
          );
        } catch {
          window.dispatchEvent(new Event("file-saved"));
        }
        window.dispatchEvent(new Event("file-refresh"));
      }
      alert("AI changes enqueued for apply to " + path);
      setDismissIndex(idx);
    } catch (e) {
      console.error(e);
      alert("Apply error: " + String(e));
    }
  };

  const rejectDiff = () => {
    // Do not modify disk; just hide this diff until a new one comes
    setDismissIndex(idx);
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 8,
        borderRadius: 6,
        border: "1px solid #1f2937",
        background: "#020617",
        color: "#e5e7eb",
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 6,
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 999,
            background: "#1d4ed833",
            color: "#60a5fa",
            textTransform: "uppercase",
            letterSpacing: 0.08,
          }}
        >
          AI Diff
        </span>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{path}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            onClick={rejectDiff}
            style={{
              padding: "2px 8px",
              fontSize: 11,
              borderRadius: 6,
              border: "1px solid #4b5563",
              background: "#020617",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            Reject
          </button>
          <button
            onClick={applyDiff}
            style={{
              padding: "2px 8px",
              fontSize: 11,
              borderRadius: 6,
              border: "1px solid #22c55e",
              background: "#16a34a",
              color: "#f9fafb",
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          fontSize: 11,
        }}
      >
        <div>
          <div
            style={{
              marginBottom: 4,
              color: "#9ca3af",
              textTransform: "uppercase",
            }}
          >
            Original
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#020617",
              border: "1px solid #1f2937",
              borderRadius: 4,
              padding: 6,
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            {original}
          </pre>
        </div>
        <div>
          <div
            style={{
              marginBottom: 4,
              color: "#9ca3af",
              textTransform: "uppercase",
            }}
          >
            Proposed
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#020617",
              border: "1px solid #1f2937",
              borderRadius: 4,
              padding: 6,
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            {proposed}
          </pre>
        </div>
      </div>
    </div>
  );
}
