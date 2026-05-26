/**
 * client/src/features/diff-approval/DiffViewer.tsx
 *
 * Diff viewer for the approval modal.
 *
 * When oldContent + newContent are provided → Monaco DiffEditor (side-by-side
 * or inline, user-toggled). This mirrors the VS Code / Cursor SCM experience.
 *
 * When only a unified diff string is provided → clean text-based diff renderer
 * (fallback, used while content is loading or unavailable).
 *
 * Props
 *   diff        — unified diff string (always required; used for stats + fallback)
 *   filePath    — file path (language detection + header label)
 *   oldContent  — original file content (enables Monaco mode)
 *   newContent  — modified file content (enables Monaco mode)
 *   maxHeight   — CSS height cap (default "320px")
 */

import { useState }   from "react";
import { DiffEditor } from "@monaco-editor/react";
import { Columns2, AlignLeft } from "lucide-react";
import { cn }         from "@/lib/utils";

interface Props {
  diff:        string;
  filePath:    string;
  oldContent?: string;
  newContent?: string;
  maxHeight?:  string;
}

// ── Language detection ────────────────────────────────────────────────────────

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const MAP: Record<string, string> = {
    ts: "typescript",  tsx: "typescript",
    js: "javascript",  jsx: "javascript",
    py: "python",      rs: "rust",        go: "go",
    java: "java",      cs: "csharp",      cpp: "cpp",    c: "c",
    css: "css",        scss: "scss",      less: "less",
    html: "html",      json: "json",      md: "markdown",
    yaml: "yaml",      yml: "yaml",       sh: "shell",
    bash: "shell",     sql: "sql",        toml: "toml",
    xml: "xml",        rb: "ruby",        php: "php",
    swift: "swift",    kt: "kotlin",
  };
  return MAP[ext] ?? "plaintext";
}

// ── Unified-diff parsing (text fallback) ──────────────────────────────────────

interface DiffLine {
  type:    "meta" | "hunk" | "add" | "del" | "ctx";
  content: string;
}

function parseDiffLines(diff: string): DiffLine[] {
  return diff.split("\n").map((line): DiffLine => {
    if (line.startsWith("--- ") || line.startsWith("+++ ")) return { type: "meta",   content: line };
    if (line.startsWith("@@"))                                return { type: "hunk",   content: line };
    if (line.startsWith("+"))                                 return { type: "add",    content: line };
    if (line.startsWith("-"))                                 return { type: "del",    content: line };
    return { type: "ctx", content: line };
  });
}

function diffStats(diff: string) {
  const lines = diff.split("\n");
  return {
    additions: lines.filter(l => l.startsWith("+") && !l.startsWith("+++")).length,
    deletions: lines.filter(l => l.startsWith("-") && !l.startsWith("---")).length,
  };
}

// ── Monaco options ────────────────────────────────────────────────────────────

function buildMonacoOptions(splitView: boolean) {
  return {
    renderSideBySide:     splitView,
    readOnly:             true,
    minimap:              { enabled: false },
    scrollBeyondLastLine: false,
    fontSize:             11,
    lineHeight:           18,
    scrollbar:            { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
    renderLineHighlight:  "none" as const,
    overviewRulerLanes:   0,
    padding:              { top: 8, bottom: 8 },
    wordWrap:             "off" as const,
    folding:              false,
    glyphMargin:          false,
    lineDecorationsWidth: 0,
    contextmenu:          false,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DiffViewer({
  diff,
  filePath,
  oldContent,
  newContent,
  maxHeight = "320px",
}: Props) {
  const [splitView, setSplitView] = useState(true);

  const hasContent = oldContent !== undefined && newContent !== undefined;
  const lang       = detectLanguage(filePath);
  const stats      = diffStats(diff);

  // ── Shared stats + toggle bar ─────────────────────────────────────────────
  const statsBar = (
    <div
      className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30"
      data-testid="diff-viewer-stats"
    >
      <div className="flex items-center gap-2 text-xs font-mono">
        {stats.additions > 0 && (
          <span className="text-emerald-400 font-semibold">+{stats.additions}</span>
        )}
        {stats.deletions > 0 && (
          <span className="text-red-400 font-semibold">-{stats.deletions}</span>
        )}
        {stats.additions === 0 && stats.deletions === 0 && (
          <span className="text-muted-foreground">no changes</span>
        )}
        <span className="text-muted-foreground/50 ml-1 hidden sm:inline">{lang}</span>
      </div>

      {hasContent && (
        <button
          onClick={() => setSplitView(v => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded hover:bg-white/5"
          data-testid="diff-viewer-toggle"
          title={splitView ? "Switch to inline view" : "Switch to side-by-side view"}
        >
          {splitView
            ? <AlignLeft className="size-3" />
            : <Columns2  className="size-3" />}
          {splitView ? "Inline" : "Split"}
        </button>
      )}
    </div>
  );

  // ── Monaco side-by-side / inline diff ────────────────────────────────────
  if (hasContent) {
    return (
      <div
        className="rounded-lg overflow-hidden border border-border"
        data-testid="diff-viewer-monaco"
      >
        {statsBar}
        <DiffEditor
          original={oldContent}
          modified={newContent}
          language={lang}
          theme="vs-dark"
          height={maxHeight}
          options={buildMonacoOptions(splitView)}
        />
      </div>
    );
  }

  // ── Text-diff fallback (no oldContent / newContent available) ─────────────
  if (!diff) {
    return (
      <div className="text-sm text-muted-foreground px-4 py-6 text-center">
        No changes detected.
      </div>
    );
  }

  const lines = parseDiffLines(diff);

  return (
    <div
      className="rounded-lg overflow-hidden border border-border"
      data-testid="diff-viewer-text"
    >
      {statsBar}
      <div
        className="overflow-auto bg-[#0d1117] font-mono text-xs leading-[18px]"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              if (line.type === "meta") return null;
              return (
                <tr
                  key={i}
                  className={cn(
                    line.type === "add"  && "bg-emerald-950/40",
                    line.type === "del"  && "bg-red-950/40",
                    line.type === "hunk" && "bg-blue-950/30",
                  )}
                >
                  <td
                    className={cn(
                      "select-none w-4 px-2 text-right border-r border-border/30 text-[10px]",
                      line.type === "add"  && "text-emerald-500/60",
                      line.type === "del"  && "text-red-500/60",
                      line.type === "ctx"  && "text-muted-foreground/40",
                      line.type === "hunk" && "text-blue-400/60",
                    )}
                  >
                    {line.type === "add" ? "+" : line.type === "del" ? "−" : ""}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-px whitespace-pre-wrap break-all",
                      line.type === "add"  && "text-emerald-300",
                      line.type === "del"  && "text-red-300",
                      line.type === "ctx"  && "text-slate-400",
                      line.type === "hunk" && "text-blue-400 italic",
                    )}
                  >
                    {line.content.slice(1) || "\u00a0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
