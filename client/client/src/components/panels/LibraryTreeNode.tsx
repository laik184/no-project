import { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileNode } from "./library-panel-data";

export function getLanguageIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "html") return <FileCode className="h-3.5 w-3.5 text-orange-400" />;
  if (ext === "css") return <FileCode className="h-3.5 w-3.5 text-blue-400" />;
  if (ext === "json") return <FileJson className="h-3.5 w-3.5 text-yellow-400" />;
  if (ext === "js" || ext === "ts" || ext === "jsx" || ext === "tsx")
    return <FileCode className="h-3.5 w-3.5 text-yellow-300" />;
  if (ext === "md") return <FileText className="h-3.5 w-3.5 text-slate-400" />;
  return <File className="h-3.5 w-3.5 text-slate-400" />;
}

export interface TreeNodeProps {
  node: FileNode;
  depth: number;
  expandedIds: Set<string>;
  activeFileId: string | null;
  renamingId: string | null;
  dragOverId: string | null;
  onToggle: (id: string) => void;
  onFileClick: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onRenameSubmit: (id: string, name: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string) => void;
}

export function TreeNode({
  node, depth, expandedIds, activeFileId, renamingId, dragOverId,
  onToggle, onFileClick, onContextMenu, onRenameSubmit, onDragStart, onDragOver, onDrop,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const isActive = activeFileId === node.id;
  const isRenaming = renamingId === node.id;
  const isDragOver = dragOverId === node.id;
  const [renameVal, setRenameVal] = useState(node.name);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameVal(node.name);
      setTimeout(() => renameRef.current?.select(), 50);
    }
  }, [isRenaming, node.name]);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-0.5 px-1 rounded-md cursor-pointer group select-none transition-colors",
          isActive ? "bg-primary/15 text-foreground" : "hover:bg-white/5 text-foreground/70 hover:text-foreground",
          isDragOver && node.type === "folder" ? "bg-primary/10 border border-primary/30" : ""
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => node.type === "folder" ? onToggle(node.id) : onFileClick(node)}
        onContextMenu={(e) => onContextMenu(e, node.id)}
        draggable
        onDragStart={() => onDragStart(node.id)}
        onDragOver={(e) => onDragOver(e, node.id)}
        onDrop={() => onDrop(node.id)}
        data-testid={`tree-node-${node.id}`}
      >
        {node.type === "folder" ? (
          <span className="flex-shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        <span className="flex-shrink-0">
          {node.type === "folder"
            ? isExpanded
              ? <FolderOpen className="h-3.5 w-3.5 text-yellow-400/80" />
              : <Folder className="h-3.5 w-3.5 text-yellow-400/80" />
            : getLanguageIcon(node.name)}
        </span>

        {isRenaming ? (
          <input
            ref={renameRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={() => onRenameSubmit(node.id, renameVal)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit(node.id, renameVal);
              if (e.key === "Escape") onRenameSubmit(node.id, node.name);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-white/10 text-xs text-foreground px-1 rounded outline-none border border-primary/50 min-w-0"
            data-testid={`input-rename-${node.id}`}
          />
        ) : (
          <span className="text-xs truncate flex-1">{node.name}</span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onContextMenu(e, node.id); }}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 text-muted-foreground hover:text-foreground transition-all ml-auto"
          data-testid={`button-dotmenu-${node.id}`}
          title="More actions"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      </div>

      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              activeFileId={activeFileId}
              renamingId={renamingId}
              dragOverId={dragOverId}
              onToggle={onToggle}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
              onRenameSubmit={onRenameSubmit}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
