import { useState } from "react";
import { CheckCircle2, Loader2, ThumbsUp, ThumbsDown, GitPullRequest, X } from "lucide-react";

type AcceptState = "pending" | "accepting" | "accepted" | "rejected" | "error";

interface DiffAcceptRejectBarProps {
  filePath: string;
  proposed: string;
}

export function DiffAcceptRejectBar({ filePath, proposed }: DiffAcceptRejectBarProps) {
  const [state,  setState]  = useState<AcceptState>("pending");
  const [errMsg, setErrMsg] = useState("");

  const handleAccept = async () => {
    setState("accepting");
    try {
      const res = await fetch("/api/agent/diff-queue/apply", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ runId: null, files: [{ path: filePath, content: proposed }] }),
      });
      if (!res.ok) {
        setErrMsg((await res.text().catch(() => `HTTP ${res.status}`)).slice(0, 80));
        setState("error");
        return;
      }
      window.dispatchEvent(new CustomEvent("file-saved", { detail: { path: filePath } }));
      window.dispatchEvent(new Event("file-refresh"));
      setState("accepted");
    } catch (e) {
      setErrMsg(String(e).slice(0, 80));
      setState("error");
    }
  };

  if (state === "accepted") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-[10px]"
        style={{ borderTop: "1px solid rgba(34,197,94,0.15)", color: "#22c55e" }}>
        <CheckCircle2 style={{ width: 11, height: 11 }} /> Change applied
      </div>
    );
  }
  if (state === "rejected") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-[10px]"
        style={{ borderTop: "1px solid rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.7)" }}>
        <X style={{ width: 11, height: 11 }} /> Change rejected
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px solid #1f2937" }}>
      {state === "error" && errMsg && (
        <p className="px-3 pt-1.5 text-[9.5px]" style={{ color: "#ef4444" }}>{errMsg}</p>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <GitPullRequest style={{ width: 11, height: 11, color: "rgba(59,130,246,0.7)", flexShrink: 0 }} />
        <span className="flex-1 text-[10px]" style={{ color: "#94a3b8" }}>AI proposes this change</span>
        <button
          onClick={() => setState("rejected")}
          disabled={state === "accepting"}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9.5px] font-medium transition-all hover:bg-white/[0.06]"
          style={{ border: "1px solid rgba(239,68,68,0.25)", color: "rgba(239,68,68,0.8)" }}
          data-testid="button-diff-reject">
          <ThumbsDown style={{ width: 10, height: 10 }} /> Reject
        </button>
        <button
          onClick={handleAccept}
          disabled={state === "accepting"}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[9.5px] font-medium transition-all"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}
          data-testid="button-diff-accept">
          {state === "accepting"
            ? <Loader2 className="animate-spin" style={{ width: 10, height: 10 }} />
            : <ThumbsUp style={{ width: 10, height: 10 }} />}
          {state === "accepting" ? "Applying…" : "Accept"}
        </button>
      </div>
    </div>
  );
}
