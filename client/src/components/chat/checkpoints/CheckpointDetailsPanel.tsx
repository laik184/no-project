/**
 * CheckpointDetailsPanel — expanded metadata view inside a checkpoint row.
 * Shows: description, timestamp, files-changed count, per-category file list.
 * < 100 LOC
 */
import { FileCode, FilePlus, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortPath } from "./CheckpointUtils";

interface Props {
  description:   string;
  timestamp:     string;
  createdFiles:  string[];
  modifiedFiles: string[];
  deletedFiles:  string[];
}

function FileGroup({
  label, files, color, Icon,
}: { label: string; files: string[]; color: string; Icon: React.FC<{ className?: string; style?: React.CSSProperties }> }) {
  if (files.length === 0) return null;
  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-2.5 w-2.5" style={{ color }} />
        <span className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color }}>
          {label} ({files.length})
        </span>
      </div>
      <div className="flex flex-col gap-0.5 pl-4">
        {files.map((f) => (
          <span key={f} className="text-[10px] font-mono truncate" style={{ color: "rgba(203,213,225,0.75)" }}>
            {shortPath(f)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CheckpointDetailsPanel({ description, timestamp, createdFiles, modifiedFiles, deletedFiles }: Props) {
  const total = createdFiles.length + modifiedFiles.length + deletedFiles.length;
  return (
    <div className={cn("px-3 pb-3 pt-2.5 space-y-2")} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="text-[10.5px] leading-relaxed" style={{ color: "rgba(203,213,225,0.8)" }}>
        {description}
      </p>
      <div className="flex items-center gap-2">
        <Clock className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(124,141,255,0.7)" }} />
        <span className="text-[10.5px]" style={{ color: "rgba(148,163,184,0.7)" }}>
          Saved <span style={{ color: "rgba(203,213,225,0.9)", fontWeight: 500 }}>{timestamp}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <FileCode className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(124,141,255,0.7)" }} />
        <span className="text-[10.5px]" style={{ color: "rgba(148,163,184,0.7)" }}>
          <span style={{ color: "rgba(203,213,225,0.9)", fontWeight: 500 }}>{total} file{total !== 1 ? "s" : ""}</span> changed
        </span>
      </div>
      {total > 0 && (
        <div className="mt-1 px-2.5 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <FileGroup label="Created"  files={createdFiles}  color="#4ade80" Icon={FilePlus} />
          <FileGroup label="Modified" files={modifiedFiles} color="#7c8dff" Icon={FileCode} />
          <FileGroup label="Deleted"  files={deletedFiles}  color="#f87171" Icon={Trash2}  />
        </div>
      )}
    </div>
  );
}
