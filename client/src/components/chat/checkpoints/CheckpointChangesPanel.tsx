/**
 * CheckpointChangesPanel — collapsible panel showing created/modified/deleted file lists.
 * Reuses FileDiff visual style. No duplicate diff engine.
 * < 100 LOC
 */
import { useState } from "react";
import { ChevronDown, FilePlus, FileEdit, Trash2, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortPath } from "./CheckpointUtils";

interface Props {
  createdFiles:  string[];
  modifiedFiles: string[];
  deletedFiles:  string[];
}

interface GroupProps {
  label: string;
  files: string[];
  color: string;
  bg:    string;
  Icon:  React.FC<{ className?: string; style?: React.CSSProperties }>;
}

function FileRow({ path, color }: { path: string; color: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 pl-2" data-testid={`change-file-${path}`}>
      <FileCode className="h-2.5 w-2.5 flex-shrink-0" style={{ color }} />
      <span className="text-[10px] font-mono truncate" style={{ color: "rgba(203,213,225,0.8)" }}>
        {shortPath(path)}
      </span>
    </div>
  );
}

function FileGroup({ label, files, color, bg, Icon }: GroupProps) {
  const [open, setOpen] = useState(true);
  if (files.length === 0) return null;
  return (
    <div className="mb-1.5">
      <button
        className="flex items-center gap-1.5 w-full px-2 py-1 rounded transition-all hover:bg-white/5"
        onClick={() => setOpen((v) => !v)}
        data-testid={`button-toggle-group-${label}`}
      >
        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <Icon className="h-2.5 w-2.5" style={{ color }} />
        </div>
        <span className="text-[10.5px] font-medium flex-1 text-left" style={{ color }}>
          {label} <span style={{ color: "rgba(148,163,184,0.6)", fontWeight: 400 }}>({files.length})</span>
        </span>
        <ChevronDown className="h-2.5 w-2.5 transition-transform" style={{ color: "rgba(148,163,184,0.5)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <div className="pl-2 mt-0.5">
          {files.map((f) => <FileRow key={f} path={f} color={color} />)}
        </div>
      )}
    </div>
  );
}

export function CheckpointChangesPanel({ createdFiles, modifiedFiles, deletedFiles }: Props) {
  const total = createdFiles.length + modifiedFiles.length + deletedFiles.length;
  if (total === 0) {
    return (
      <div className="px-3 py-3 text-center">
        <p className="text-[10.5px]" style={{ color: "rgba(148,163,184,0.5)" }}>No file changes recorded</p>
      </div>
    );
  }
  return (
    <div className={cn("px-2 py-2")} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", animation: "checkpoint-in 0.15s ease-out both" }}>
      <FileGroup label="Created"  files={createdFiles}  color="#4ade80" bg="rgba(74,222,128,0.1)"  Icon={FilePlus} />
      <FileGroup label="Modified" files={modifiedFiles} color="#7c8dff" bg="rgba(124,141,255,0.1)" Icon={FileEdit} />
      <FileGroup label="Deleted"  files={deletedFiles}  color="#f87171" bg="rgba(248,113,113,0.1)" Icon={Trash2}   />
    </div>
  );
}
