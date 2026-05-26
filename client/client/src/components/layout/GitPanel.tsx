import { useState } from "react";
import { GitBranch, ChevronDown, Upload, CheckCircle } from "lucide-react";
import { FaGithub } from "react-icons/fa";

const MOCK_BRANCHES = ["main", "dev", "feature/ui-update", "fix/auth-bug"];
const MOCK_REPOS = ["mohd/nura-x", "mohd/agent-app", "mohd/portfolio"];

export function GitPanel() {
  const [githubConnected, setGithubConnected] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [showRepos, setShowRepos] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [pushState, setPushState] = useState<"idle" | "pushing" | "done">("idle");

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => { setConnecting(false); setGithubConnected(true); }, 1800);
  };

  const handlePush = () => {
    if (!commitMsg.trim()) return;
    setPushState("pushing");
    setTimeout(() => {
      setPushState("done");
      setTimeout(() => { setPushState("idle"); setCommitMsg(""); }, 2500);
    }, 2000);
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: "rgba(10,12,22,0.6)", animation: "git-fadein 0.2s ease" }}>
      <style>{`@keyframes git-fadein { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }`}</style>

      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <GitBranch style={{ width: 13, height: 13, color: "#86efac" }} />
        <span className="text-xs font-semibold" style={{ color: "rgba(226,232,240,0.8)" }}>Version Control</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: "thin" }}>
        {githubConnected ? (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <button onClick={() => { setShowBranches(v => !v); setShowRepos(false); }} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all" style={{ background: showBranches ? "rgba(134,239,172,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${showBranches ? "rgba(134,239,172,0.3)" : "rgba(255,255,255,0.08)"}`, color: "#86efac" }}>
                  <GitBranch style={{ width: 11, height: 11 }} />
                  <span className="truncate flex-1 text-left">{selectedBranch}</span>
                  <ChevronDown style={{ width: 10, height: 10, opacity: 0.6 }} />
                </button>
                {showBranches && (
                  <div className="absolute left-0 top-full mt-1 w-full rounded-lg overflow-hidden z-50" style={{ background: "rgba(15,18,32,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                    {MOCK_BRANCHES.map(b => (
                      <button key={b} onClick={() => { setSelectedBranch(b); setShowBranches(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors hover:bg-white/5 text-left" style={{ color: b === selectedBranch ? "#86efac" : "rgba(203,213,225,0.75)" }}>
                        <GitBranch style={{ width: 10, height: 10, opacity: 0.6 }} />
                        {b}
                        {b === selectedBranch && <span className="ml-auto text-[9px]" style={{ color: "#86efac" }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative flex-1">
                <button onClick={() => { setShowRepos(v => !v); setShowBranches(false); }} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all" style={{ background: showRepos ? "rgba(124,141,255,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${showRepos ? "rgba(124,141,255,0.3)" : "rgba(255,255,255,0.08)"}`, color: "#a78bfa" }}>
                  <FaGithub style={{ width: 11, height: 11 }} />
                  <span className="truncate flex-1 text-left">{selectedRepo ? selectedRepo.split("/")[1] : "Repo"}</span>
                  <ChevronDown style={{ width: 10, height: 10, opacity: 0.6 }} />
                </button>
                {showRepos && (
                  <div className="absolute left-0 top-full mt-1 w-full rounded-lg overflow-hidden z-50" style={{ background: "rgba(15,18,32,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                    {MOCK_REPOS.map(r => (
                      <button key={r} onClick={() => { setSelectedRepo(r); setShowRepos(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors hover:bg-white/5 text-left" style={{ color: r === selectedRepo ? "#a78bfa" : "rgba(203,213,225,0.75)" }}>
                        <FaGithub style={{ width: 10, height: 10, opacity: 0.6 }} />
                        {r}
                        {r === selectedRepo && <span className="ml-auto text-[9px]" style={{ color: "#a78bfa" }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(148,163,184,0.4)" }}>Push Commit</p>
              <textarea value={commitMsg} onChange={e => setCommitMsg(e.target.value)} placeholder="Write a commit message…" rows={3} disabled={pushState !== "idle"} className="w-full rounded-lg px-3 py-2 text-[11.5px] resize-none outline-none transition-all" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${commitMsg.trim() ? "rgba(124,141,255,0.25)" : "rgba(255,255,255,0.07)"}`, color: "rgba(226,232,240,0.85)", opacity: pushState !== "idle" ? 0.5 : 1 }} />
              <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(148,163,184,0.4)" }}>
                <Upload style={{ width: 9, height: 9 }} />
                <span>Push to</span>
                <span style={{ color: "#86efac" }}>{selectedBranch}</span>
                {selectedRepo && (<><span>·</span><FaGithub style={{ width: 9, height: 9 }} /><span style={{ color: "#a78bfa" }}>{selectedRepo}</span></>)}
              </div>
              <button onClick={handlePush} disabled={!commitMsg.trim() || pushState !== "idle"} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-semibold transition-all" style={{ background: pushState === "done" ? "rgba(74,222,128,0.15)" : commitMsg.trim() && pushState === "idle" ? "linear-gradient(135deg,#7c8dff,#a78bfa)" : "rgba(255,255,255,0.05)", color: pushState === "done" ? "#4ade80" : commitMsg.trim() && pushState === "idle" ? "#fff" : "rgba(148,163,184,0.3)", cursor: commitMsg.trim() && pushState === "idle" ? "pointer" : "not-allowed", border: pushState === "done" ? "1px solid rgba(74,222,128,0.3)" : "none" }}>
                {pushState === "done" ? (<><CheckCircle style={{ width: 13, height: 13 }} /> Pushed successfully!</>) : pushState === "pushing" ? (<><span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" /> Pushing…</>) : (<><Upload style={{ width: 13, height: 13 }} /> Push Commit</>)}
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-4 gap-1.5">
              <GitBranch style={{ width: 20, height: 20, color: "rgba(148,163,184,0.15)" }} />
              <p className="text-[10.5px] text-center" style={{ color: "rgba(148,163,184,0.35)" }}>No staged or changed files</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-4 px-2">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <FaGithub style={{ width: 28, height: 28, color: "rgba(226,232,240,0.7)" }} />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-semibold mb-1" style={{ color: "rgba(226,232,240,0.85)" }}>Connect with GitHub</p>
              <p className="text-[10.5px]" style={{ color: "rgba(148,163,184,0.45)" }}>Login to view branches, repos and sync your code</p>
            </div>
            <button onClick={handleConnect} disabled={connecting} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all" style={{ background: connecting ? "rgba(255,255,255,0.05)" : "rgba(226,232,240,0.9)", color: connecting ? "rgba(148,163,184,0.5)" : "#0d1117", cursor: connecting ? "not-allowed" : "pointer", border: "1px solid rgba(255,255,255,0.1)" }}>
              <FaGithub style={{ width: 14, height: 14 }} />
              {connecting ? "Connecting…" : "Login with GitHub"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
