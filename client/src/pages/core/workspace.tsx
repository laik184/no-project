import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Send,
  Plus,
  MessageSquarePlus,
  History,
  Puzzle,
  HardDrive,
  Lock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Users,
  Upload,
  Code2,
  RefreshCw,
  Maximize2,
  Smartphone,
  Monitor,
  Bot,
  Sparkles,
  Home,
  X,
  ExternalLink,
  MoreHorizontal,
  Shield,
  ImagePlus,
  CheckCircle2,
  Mail,
  UserPlus,
  Paperclip,
  ImageIcon,
  FolderOpen,
  Brain,
  FileText,
  FileCode,
  Trash2,
  Package,
  Server,
  GitBranch,
  Camera,
  ScrollText,
  Zap,
  Link,
} from "lucide-react";
import { CenterPanel, type WorkspaceTab } from "@/components/layout/CenterPanel";
import { cn } from "@/lib/utils";
import { AgentsButton } from "@/components/agent/AgentsHub";
import { AgentMarkdown } from "@/components/agent/AgentMarkdown";
import { CheckpointCard, type CheckpointData } from "@/components/panels/CheckpointCard";
import { type AgentStreamItem } from "@/components/agent/AgentActionFeed";
import { generateMockDiffs, type FileDiff } from "@/components/diff/FileDiffCard";
import { ChatPanel } from "@/components/chat";
import { DiffApprovalModal } from "@/features/diff-approval/DiffApprovalModal";

function InvitePopup({ onClose }: { onClose: () => void }) {
  const [email, setEmail]       = useState("");
  const [imgSrc, setImgSrc]     = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sent, setSent]         = useState(false);
  const fileRef                 = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setImgSrc(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const handleSend = () => {
    if (!email.trim()) return;
    setSent(true);
  };

  const CARD = {
    background: "rgba(15,18,30,0.97)",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-80 rounded-2xl overflow-hidden flex flex-col"
        style={{ top: "52px", right: "16px", ...CARD, animation: "invite-in 0.2s cubic-bezier(0.22,1,0.36,1)" }}
      >
        <style>{`
          @keyframes invite-in { from{opacity:0;transform:translateY(-8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2">
            <UserPlus className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
            <span className="text-[13px] font-semibold" style={{ color: "rgba(226,232,240,0.9)" }}>Invite collaborator</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-all duration-150"
            style={{ color: "rgba(148,163,184,0.45)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(226,232,240,0.8)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.45)"; }}
            data-testid="button-close-invite"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(74,222,128,0.12)", border: "2px solid rgba(74,222,128,0.35)" }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: "#4ade80" }} />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold" style={{ color: "rgba(226,232,240,0.95)" }}>Invite sent!</p>
              <p className="text-[11.5px] mt-1" style={{ color: "rgba(100,116,139,0.6)" }}>{email}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-1 px-5 py-2 rounded-xl text-[12.5px] font-semibold transition-all duration-150"
              style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}
              data-testid="button-invite-done"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3.5">

            {/* Avatar upload */}
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: "rgba(100,116,139,0.5)" }}>Profile photo (optional)</p>
              <div
                className="relative flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all duration-200"
                style={{
                  height: "96px",
                  background: dragging ? "rgba(124,141,255,0.1)" : "rgba(255,255,255,0.025)",
                  border: `1.5px dashed ${dragging ? "rgba(124,141,255,0.6)" : "rgba(255,255,255,0.1)"}`,
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                data-testid="dropzone-avatar"
              >
                {imgSrc ? (
                  <>
                    <img src={imgSrc} alt="avatar" className="w-16 h-16 rounded-full object-cover" style={{ border: "2px solid rgba(124,141,255,0.35)" }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setImgSrc(null); }}
                      className="absolute top-1.5 right-1.5 p-0.5 rounded-full"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                      data-testid="button-remove-avatar"
                    >
                      <X className="h-3 w-3" style={{ color: "rgba(226,232,240,0.7)" }} />
                    </button>
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6 mb-1.5" style={{ color: "rgba(100,116,139,0.4)" }} />
                    <p className="text-[11px]" style={{ color: "rgba(100,116,139,0.4)" }}>Drop image or click to upload</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} data-testid="input-avatar-file" />
            </div>

            {/* Email */}
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: "rgba(100,116,139,0.5)" }}>Email address</p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "rgba(100,116,139,0.4)" }} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  placeholder="collaborator@example.com"
                  type="email"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-[12.5px] outline-none transition-all duration-150"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(226,232,240,0.9)" }}
                  autoFocus
                  data-testid="input-invite-email"
                />
              </div>
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!email.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150"
              style={{
                background: email.trim() ? "linear-gradient(135deg,#7c8dff,#a78bfa)" : "rgba(255,255,255,0.05)",
                color: email.trim() ? "#fff" : "rgba(148,163,184,0.35)",
                border: email.trim() ? "none" : "1px solid rgba(255,255,255,0.07)",
                cursor: email.trim() ? "pointer" : "not-allowed",
              }}
              data-testid="button-send-invite"
            >
              <Send className="h-3.5 w-3.5" />
              Send invite
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function Workspace() {
  const [, navigate] = useLocation();
  const [chatInput, setChatInput] = useState("");
  // Preview tab is open by default so the user immediately sees their app.
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    { id: 1, label: "Preview", url: "/preview" },
  ]);
  const [activeTabId, setActiveTabId] = useState<number>(1);
  const nextTabId = useRef(2);
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [activeFileName, setActiveFileName] = useState("");

  const addTab = () => {
    const id = nextTabId.current++;
    setTabs((prev) => [...prev, { id, label: "New tab" }]);
    setActiveTabId(id);
  };

  const addToolTab = (label: string, url: string) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.url === url && t.label === label);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const id = nextTabId.current++;
      setActiveTabId(id);
      return [...prev, { id, label, url }];
    });
  };

  const openFileTab = (name: string, content: string, lang: string) => {
    setActiveFileName(name);
    setTabs((prev) => {
      const existing = prev.find((t) => t.fileContent !== undefined && t.label === name);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const id = nextTabId.current++;
      setActiveTabId(id);
      return [...prev, { id, label: name, fileContent: content, fileLang: lang }];
    });
  };

  const closeTab = (id: number) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        setActiveTabId(0);
      } else if (id === activeTabId) {
        setActiveTabId(next[next.length - 1].id);
      }
      return next;
    });
  };
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab?.fileContent !== undefined) {
      setActiveFileName(activeTab.label);
    } else {
      setActiveFileName("");
    }
  }, [activeTabId, tabs]);

  const params = new URLSearchParams(window.location.search);
  const initialPrompt = params.get("prompt") || "";

  const projectName = initialPrompt
    ? initialPrompt.length > 28
      ? initialPrompt.slice(0, 28) + "..."
      : initialPrompt
    : "New Project";

  return (
    <>
      {/* IDE Layout */}
      <div
        className="flex flex-col h-full w-full min-h-0 overflow-hidden bg-[#080808]"
        style={{ minWidth: 0 }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{
            background: "rgba(255,255,255,0.025)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Left: home */}
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-xs text-foreground/70 hover:bg-white/8 hover:text-foreground hover:border-white/14 transition-all flex-shrink-0"
              data-testid="button-home"
              title="Home"
            >
              <Home className="h-3.5 w-3.5" />
              Home
            </button>
          </div>

          {/* Center: project name */}
          <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)" }}
            >
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground/90 max-w-[220px] truncate" data-testid="text-project-name">
              {projectName}
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInvitePopup((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-xs text-foreground/70 hover:bg-white/8 hover:text-foreground hover:border-white/14 transition-all"
              data-testid="button-invite"
            >
              <Users className="h-3.5 w-3.5" />
              Invite
            </button>
            <button
              onClick={() => addToolTab("Publishing", "__publishing__")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)",
                boxShadow: "0 0 16px rgba(124,141,255,0.35)",
              }}
              data-testid="button-publish"
            >
              <Upload className="h-3.5 w-3.5" />
              Publish
            </button>
            <button
              onClick={() => setShowFileExplorer((v) => !v)}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-200",
                showFileExplorer
                  ? "bg-primary/15 border-primary/35 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/6 border-transparent hover:border-white/10"
              )}
              title="File Explorer"
              data-testid="button-file-explorer"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Three-panel body */}
        <PanelGroup direction="horizontal" className="flex-1 overflow-hidden min-h-0">

          {/* LEFT: Chat Panel */}
          <Panel defaultSize={29} minSize={15} maxSize={40}>
            <div className="h-full flex">
              <div style={{ width: 1, flexShrink: 0, background: "rgba(255,255,255,0.08)" }} />
              <div className="flex-1 min-w-0">
                <ChatPanel inputRef={chatInputRef} onOpenFile={openFileTab} />
              </div>
            </div>
          </Panel>


          <PanelResizeHandle className="w-[3px] hover:bg-primary/40 transition-colors duration-150 cursor-col-resize" style={{ background: "rgba(255,255,255,0.07)" }} />

          {/* CENTER: Workspace / Preview */}
          <Panel defaultSize={71} minSize={40}>
            <CenterPanel
              tabs={tabs}
              activeTabId={activeTabId}
              setActiveTabId={setActiveTabId}
              addTab={addTab}
              closeTab={closeTab}
              addToolTab={addToolTab}
              openFileTab={openFileTab}
              showFileExplorer={showFileExplorer}
              setShowFileExplorer={setShowFileExplorer}
              activeFileName={activeFileName}
            />
          </Panel>

        </PanelGroup>
      </div>

      {showInvitePopup && <InvitePopup onClose={() => setShowInvitePopup(false)} />}
      <DiffApprovalModal />
    </>
  );
}
