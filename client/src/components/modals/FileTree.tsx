import { FileText, FolderPlus, ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FileItem {
  name: string;
  isDirectory: boolean;
  path: string;
  children: FileItem[];
}

interface FileTreeProps {
  items: FileItem[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileOpen?: (path: string) => void;
  onDeleteFile: (path: string, e?: React.MouseEvent) => void;
  depth?: number;
}

export function FileTree({ items, expandedFolders, onToggleFolder, onFileOpen, onDeleteFile, depth = 0 }: FileTreeProps) {
  return (
    <>
      {items.flatMap(item => {
        const isExpanded = expandedFolders.has(item.path);
        return [
          <div
            key={item.path}
            className="flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer group"
            style={{ marginLeft: `${depth * 8}px` }}
            data-testid={`file-item-${item.path}`}
            onClick={() => {
              if (item.isDirectory) {
                onToggleFolder(item.path);
              } else {
                onFileOpen?.(item.path);
              }
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {item.isDirectory ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFolder(item.path); }}
                    className="p-0 hover:bg-gray-700/50 rounded"
                    data-testid={`button-toggle-${item.path}`}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </button>
                  <FolderPlus className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
                </>
              ) : (
                <>
                  <div className="w-4" />
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0" />
                </>
              )}
              <span className="text-gray-300 text-xs sm:text-sm truncate">{item.name}</span>
            </div>
            <Button
              variant="ghost" size="icon"
              onClick={(e) => onDeleteFile(item.path, e)}
              className="h-6 w-6 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`button-delete-${item.path}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>,
          ...(item.isDirectory && isExpanded && item.children
            ? [<FileTree key={`${item.path}-children`} items={item.children} expandedFolders={expandedFolders} onToggleFolder={onToggleFolder} onFileOpen={onFileOpen} onDeleteFile={onDeleteFile} depth={depth + 1} />]
            : [])
        ];
      })}
    </>
  );
}
