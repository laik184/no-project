import { AlignLeft, WrapText, File, Palette, Globe, FileJson, Code2, FileType2, ImageIcon, FileText, Settings2, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import type { SaveStatus } from "@/features/editor/types/auto-save.types";

export type WorkspaceTab = {
  id: number;
  label: string;
  url?: string;
  fileContent?: string;
  fileLang?: string;
  filePath?: string;
};

export function fileTabIcon(label: string, lang?: string): React.ReactElement {
  const name = label.toLowerCase();
  if (lang === "css"  || name.endsWith(".css"))  return <Palette     style={{ width: 11, height: 11, color: "#f472b6" }} />;
  if (lang === "html" || name.endsWith(".html")) return <Globe       style={{ width: 11, height: 11, color: "#fb923c" }} />;
  if (lang === "json" || name.endsWith(".json")) return <FileJson    style={{ width: 11, height: 11, color: "#fbbf24" }} />;
  if (name.endsWith(".tsx") || name.endsWith(".jsx")) return <Code2  style={{ width: 11, height: 11, color: "#60a5fa" }} />;
  if (name.endsWith(".ts")  || name.endsWith(".js"))  return <FileType2 style={{ width: 11, height: 11, color: "#34d399" }} />;
  if (name.match(/\.(png|jpg|jpeg|svg|gif|webp)$/))   return <ImageIcon style={{ width: 11, height: 11, color: "#c084fc" }} />;
  if (name.endsWith(".md"))    return <FileText  style={{ width: 11, height: 11, color: "#94a3b8" }} />;
  if (name.startsWith(".env")) return <Settings2 style={{ width: 11, height: 11, color: "#a3e635" }} />;
  return <File style={{ width: 11, height: 11, color: "#64748b" }} />;
}

export function langDisplayName(lang?: string): string {
  const map: Record<string, string> = {
    typescript: "TypeScript", javascript: "JavaScript",
    css: "CSS", html: "HTML", json: "JSON",
    plaintext: "Plain Text", markdown: "Markdown",
    python: "Python", rust: "Rust", go: "Go",
  };
  return lang ? (map[lang] ?? lang) : "Plain Text";
}

interface ToolbarBtnProps {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  active?: boolean;
  "data-testid"?: string;
}

export function ToolbarBtn({ children, onClick, title, active = false, "data-testid": testId }: ToolbarBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testId}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors"
      style={{
        background: active ? "rgba(124,141,255,0.12)" : "transparent",
        color: active ? "#a78bfa" : "rgba(148,163,184,0.5)",
        border: active ? "1px solid rgba(124,141,255,0.2)" : "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
          (e.currentTarget as HTMLElement).style.color = "rgba(226,232,240,0.75)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.5)";
        }
      }}
    >
      {children}
    </button>
  );
}

export function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  if (status === "pending") {
    return (
      <span className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(148,163,184,0.5)" }}>
        <span className="w-1 h-1 rounded-full bg-slate-500 animate-pulse" />
        editing
      </span>
    );
  }

  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#60a5fa" }}>
        <Loader2 style={{ width: 9, height: 9 }} className="animate-spin" />
        saving…
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#34d399" }}>
        <CheckCircle2 style={{ width: 9, height: 9 }} />
        saved
      </span>
    );
  }

  if (status === "conflict") {
    return (
      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#f59e0b" }}>
        <AlertTriangle style={{ width: 9, height: 9 }} />
        conflict
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#f87171" }}>
        <AlertCircle style={{ width: 9, height: 9 }} />
        save failed
      </span>
    );
  }

  return null;
}

interface EditorToolbarProps {
  label: string;
  lang?: string;
  modified: boolean;
  saveStatus: SaveStatus;
  wordWrap: boolean;
  line: number;
  col: number;
  onToggleWrap: () => void;
  onFormat: () => void;
}

export function EditorToolbar({ label, lang, modified, saveStatus, wordWrap, line, col, onToggleWrap, onFormat }: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 flex-shrink-0" style={{ height: 30, background: "rgba(255,255,255,0.018)", borderBottom: "1px solid rgba(255,255,255,0.065)" }}>
      <div className="flex items-center gap-1.5 min-w-0">
        {fileTabIcon(label, lang)}
        <span className="text-[11px] font-medium truncate" style={{ color: "rgba(203,213,225,0.7)" }}>{label}</span>
        {modified && saveStatus === "idle" && (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#fbbf24", boxShadow: "0 0 4px rgba(251,191,36,0.55)" }} title="Unsaved changes" />
        )}
        <SaveStatusBadge status={saveStatus} />
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <ToolbarBtn onClick={onFormat} title="Format document" data-testid="button-format">
          <AlignLeft style={{ width: 10, height: 10 }} />
          Format
        </ToolbarBtn>
        <ToolbarBtn onClick={onToggleWrap} active={wordWrap} title="Toggle word wrap" data-testid="button-word-wrap">
          <WrapText style={{ width: 10, height: 10 }} />
          Wrap
        </ToolbarBtn>
        <span className="mx-1" style={{ width: 1, height: 14, background: "rgba(255,255,255,0.08)", display: "inline-block" }} />
        <span className="text-[10px] px-1.5" style={{ color: "rgba(100,116,139,0.55)", fontVariantNumeric: "tabular-nums" }}>{langDisplayName(lang)}</span>
        <span className="text-[10px] px-1.5" style={{ color: "rgba(100,116,139,0.45)", fontVariantNumeric: "tabular-nums" }}>Ln {line}:{col}</span>
      </div>
    </div>
  );
}

export function StatusBar({ lang, modified, saveStatus, line, col }: { lang?: string; modified: boolean; saveStatus: SaveStatus; line: number; col: number }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-3" style={{ height: 22, background: "rgba(124,141,255,0.06)", borderTop: "1px solid rgba(124,141,255,0.1)" }}>
      <div className="flex items-center gap-3">
        <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.5)" }}>{langDisplayName(lang)}</span>
        <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.3)" }}>UTF-8</span>
        <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.3)" }}>LF</span>
        <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.3)" }}>Spaces: 2</span>
      </div>
      <div className="flex items-center gap-3">
        {modified && saveStatus === "idle" && (
          <span className="text-[10px]" style={{ color: "#fbbf24" }}>● Unsaved</span>
        )}
        <SaveStatusBadge status={saveStatus} />
        <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.4)", fontVariantNumeric: "tabular-nums" }}>Ln {line}, Col {col}</span>
      </div>
    </div>
  );
}
