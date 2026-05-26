import { useState } from "react";
import { ChevronRight, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileNode } from "./types";
import { fileIcon } from "./file-icon";
import { InlineInput, ActionIcon } from "./InlineInput";

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  activeFileName: string;
  onSelect: (node: FileNode) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export function TreeNode({
  node, depth, activeFileName, onSelect, onDelete, onRename,
}: TreeNodeProps) {
  const [open, setOpen]         = useState(depth < 2);
  const [renaming, setRenaming] = useState(false);
  const [hovered, setHovered]   = useState(false);

  if (node.type === "folder") {
    return (
      <div>
        <div
          className="flex items-center w-full gap-1 rounded-md text-left transition-colors cursor-pointer"
          style={{ paddingTop: 3, paddingBottom: 3, paddingLeft: 6 + depth * 12, paddingRight: 6 }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => setOpen((v) => !v)}
          data-testid={`folder-${node.name}`}
        >
          <span style={{ color: "rgba(148,163,184,0.35)", flexShrink: 0 }}>
            {open
              ? <ChevronDown  style={{ width: 11, height: 11 }} />
              : <ChevronRight style={{ width: 11, height: 11 }} />}
          </span>
          {fileIcon(node.name, "folder", open)}
          {renaming ? (
            <InlineInput
              initialValue={node.name}
              onConfirm={(n) => { onRename(node.id, n); setRenaming(false); }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <span className="text-[12px] text-foreground/75 truncate flex-1" style={{ lineHeight: "1.4" }}>
              {node.name}
            </span>
          )}
          {hovered && !renaming && (
            <div className="flex items-center gap-0.5 ml-auto pl-1 flex-shrink-0">
              <ActionIcon onClick={(e) => { e.stopPropagation(); setRenaming(true); }} title="Rename" testId={`rename-${node.name}`}>
                <Pencil style={{ width: 9, height: 9 }} />
              </ActionIcon>
              <ActionIcon onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Delete" danger testId={`delete-${node.name}`}>
                <Trash2 style={{ width: 9, height: 9 }} />
              </ActionIcon>
            </div>
          )}
        </div>
        {open && node.children?.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            activeFileName={activeFileName}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </div>
    );
  }

  const isActive = activeFileName === node.name;
  return (
    <div
      className={cn(
        "flex items-center w-full gap-1 rounded-md text-left transition-all cursor-pointer",
        isActive ? "text-foreground" : "text-foreground/60 hover:text-foreground/90"
      )}
      style={{
        paddingTop: 3, paddingBottom: 3,
        paddingLeft: 6 + depth * 12, paddingRight: 6,
        background: isActive ? "rgba(124,141,255,0.12)" : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !renaming && onSelect(node)}
      data-testid={`file-${node.name}`}
    >
      {fileIcon(node.name, "file")}
      {renaming ? (
        <InlineInput
          initialValue={node.name}
          onConfirm={(n) => { onRename(node.id, n); setRenaming(false); }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <span className="text-[12px] truncate flex-1" style={{ lineHeight: "1.4" }}>{node.name}</span>
      )}
      {hovered && !renaming && (
        <div className="flex items-center gap-0.5 ml-auto pl-1 flex-shrink-0">
          <ActionIcon onClick={(e) => { e.stopPropagation(); setRenaming(true); }} title="Rename" testId={`rename-${node.name}`}>
            <Pencil style={{ width: 9, height: 9 }} />
          </ActionIcon>
          <ActionIcon onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Delete" danger testId={`delete-${node.name}`}>
            <Trash2 style={{ width: 9, height: 9 }} />
          </ActionIcon>
        </div>
      )}
    </div>
  );
}
