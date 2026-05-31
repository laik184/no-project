import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { FileNode } from "./types";
import { fileIcon } from "./file-icon";
import { InlineInput } from "./InlineInput";

interface TreeNodeProps {
  node:              FileNode;
  depth:             number;
  activeFileName:    string;
  onSelect:          (node: FileNode) => void;
  onDelete:          (id: string) => void;
  onRename:          (id: string, newName: string) => void;
  collapseRevision?: number;
  showHidden?:       boolean;
}

export function TreeNode({
  node, depth, activeFileName, onSelect, onDelete, onRename,
  collapseRevision = 0, showHidden = false,
}: TreeNodeProps) {
  const [open, setOpen]         = useState(depth < 2);
  const [renaming, setRenaming] = useState(false);
  const [hovered, setHovered]   = useState(false);

  useEffect(() => {
    if (collapseRevision > 0) setOpen(false);
  }, [collapseRevision]);

  const indent   = 8 + depth * 16;
  const isActive = activeFileName === node.name;

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4,
    height: 22, paddingLeft: indent, paddingRight: 6,
    cursor: "pointer", userSelect: "none", fontSize: 12,
    borderLeft: isActive ? "2px solid #3b82f6" : "2px solid transparent",
    background: isActive ? "#2a2a2a" : hovered ? "#252525" : "transparent",
    color: isActive ? "#f0f0f0" : hovered ? "#d4d4d4" : "#b4b4b4",
    transition: "background .1s, color .1s",
  };

  const visibleChildren = (node.children ?? []).filter(
    (c) => showHidden || !c.name.startsWith(".")
  );

  if (node.type === "folder") {
    return (
      <div>
        <div
          style={rowStyle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => setOpen((v) => !v)}
          data-testid={`folder-${node.name}`}
        >
          <span style={{ color: "#555", flexShrink: 0, display: "flex" }}>
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
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {node.name}
            </span>
          )}
        </div>
        {open && visibleChildren.map((child) => (
          <TreeNode
            key={child.id} node={child} depth={depth + 1}
            activeFileName={activeFileName}
            onSelect={onSelect} onDelete={onDelete} onRename={onRename}
            collapseRevision={collapseRevision} showHidden={showHidden}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !renaming && onSelect(node)}
      data-testid={`file-${node.name}`}
    >
      <span style={{ width: 11, flexShrink: 0 }} />
      {fileIcon(node.name, "file")}
      {renaming ? (
        <InlineInput
          initialValue={node.name}
          onConfirm={(n) => { onRename(node.id, n); setRenaming(false); }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name}
        </span>
      )}
    </div>
  );
}
