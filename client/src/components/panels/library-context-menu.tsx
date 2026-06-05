import { RefObject } from "react";
import { Edit3, FilePlus, FolderPlus, Clipboard, Download, Trash2 } from "lucide-react";
import { FileNode } from "./library-panel-data";

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string | null;
}

interface LibraryContextMenuProps {
  contextMenu: ContextMenuState | null;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  contextNode: FileNode | null;
  onRename: (id: string) => void;
  onCreateFile: (parentId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onCopyPath: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function LibraryContextMenu({
  contextMenu, contextMenuRef, contextNode,
  onRename, onCreateFile, onCreateFolder, onCopyPath, onDownload, onDelete, onClose,
}: LibraryContextMenuProps) {
  if (!contextMenu) return null;

  return (
    <div
      ref={contextMenuRef}
      className="fixed z-50 py-1.5 rounded-xl overflow-hidden"
      style={{
        left: Math.min(contextMenu.x, window.innerWidth - 200),
        top: Math.min(contextMenu.y, window.innerHeight - 260),
        width: 192,
        background: "rgba(13,13,28,0.98)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.nodeId ? (
        <>
          <ContextMenuItem icon={<Edit3 className="h-3.5 w-3.5" />} label="Rename" onClick={() => { onRename(contextMenu.nodeId!); onClose(); }} />
          <Divider />
          {contextNode?.type === "folder" && (
            <>
              <ContextMenuItem icon={<FilePlus className="h-3.5 w-3.5" />} label="Add File" onClick={() => onCreateFile(contextMenu.nodeId)} />
              <ContextMenuItem icon={<FolderPlus className="h-3.5 w-3.5" />} label="Add Folder" onClick={() => onCreateFolder(contextMenu.nodeId)} />
              <Divider />
            </>
          )}
          <ContextMenuItem icon={<Clipboard className="h-3.5 w-3.5" />} label="Copy Path" onClick={() => onCopyPath(contextMenu.nodeId!)} />
          {contextNode?.type === "file" && (
            <ContextMenuItem icon={<Download className="h-3.5 w-3.5" />} label="Download" onClick={() => onDownload(contextMenu.nodeId!)} />
          )}
          <Divider />
          <ContextMenuItem icon={<Trash2 className="h-3.5 w-3.5 text-red-400" />} label="Delete" labelClass="text-red-400" onClick={() => onDelete(contextMenu.nodeId!)} />
        </>
      ) : (
        <>
          <ContextMenuItem icon={<FilePlus className="h-3.5 w-3.5" />} label="New File" onClick={() => onCreateFile(null)} />
          <ContextMenuItem icon={<FolderPlus className="h-3.5 w-3.5" />} label="New Folder" onClick={() => onCreateFolder(null)} />
        </>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 8px" }} />;
}

export function ContextMenuItem({ icon, label, labelClass, onClick }: { icon: React.ReactNode; label: string; labelClass?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-xs hover:bg-white/6 transition-colors text-left"
      style={{ color: "rgba(226,232,240,0.75)" }}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className={labelClass}>{label}</span>
    </button>
  );
}
