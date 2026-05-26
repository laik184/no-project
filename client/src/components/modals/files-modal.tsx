import { useState, useEffect } from "react";
import { X, FileText, FolderPlus, Upload, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileActions } from "@/hooks/useFileActions";
import { FileTree, FileItem } from "./FileTree";

interface FilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileOpen?: (path: string) => void;
}

type ButtonKey = "newFile" | "newFolder" | "upload" | "download";

export function FilesModal({ isOpen, onClose, onFileOpen }: FilesModalProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [buttonOrder, setButtonOrder] = useState<ButtonKey[]>(["newFile", "newFolder", "upload", "download"]);
  const [draggedButton, setDraggedButton] = useState<ButtonKey | null>(null);

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/files/list");
      const data = await response.json();
      setFiles(data.files);
    } catch {
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const { handleNewFile, handleNewFolder, handleUploadFiles, handleDownloadZip, handleDeleteFile } =
    useFileActions(fetchFiles, setIsLoading);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) { newExpanded.delete(path); } else { newExpanded.add(path); }
    setExpandedFolders(newExpanded);
  };

  useEffect(() => {
    if (isOpen) fetchFiles();
  }, [isOpen]);

  const buttonConfig: Record<ButtonKey, { label: string; icon: typeof FileText; onClick: () => void; testid: string }> = {
    newFile:  { label: "New file",    icon: FileText,  onClick: handleNewFile,      testid: "button-new-file" },
    newFolder:{ label: "New folder",  icon: FolderPlus,onClick: handleNewFolder,    testid: "button-new-folder" },
    upload:   { label: "Upload files",icon: Upload,    onClick: handleUploadFiles,  testid: "button-upload-files" },
    download: { label: "Download",    icon: Download,  onClick: handleDownloadZip,  testid: "button-download-zip" },
  };

  const handleDragStart = (button: ButtonKey) => setDraggedButton(button);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetButton: ButtonKey) => {
    if (!draggedButton || draggedButton === targetButton) return;
    const draggedIndex = buttonOrder.indexOf(draggedButton);
    const targetIndex = buttonOrder.indexOf(targetButton);
    const newOrder = [...buttonOrder];
    [newOrder[draggedIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[draggedIndex]];
    setButtonOrder(newOrder);
    setDraggedButton(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#080808] rounded-2xl w-full max-w-2xl h-[85vh] sm:h-[80vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-700">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white">Files</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-transparent h-8 w-8 sm:h-10 sm:w-10" data-testid="button-files-close">
            <X className="h-6 w-6 sm:h-8 sm:w-8" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-12">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
          ) : files.length === 0 ? (
            <div className="text-gray-500 text-xs sm:text-sm">No files yet. Create a new file or folder to get started.</div>
          ) : (
            <div className="space-y-1 sm:space-y-2">
              <FileTree items={files} expandedFolders={expandedFolders} onToggleFolder={toggleFolder} onFileOpen={onFileOpen} onDeleteFile={handleDeleteFile} />
            </div>
          )}
        </div>

        <div className="border-t border-gray-700 bg-[#080808] px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex gap-1.5 sm:gap-2">
            {buttonOrder.map((buttonKey) => {
              const config = buttonConfig[buttonKey];
              const Icon = config.icon;
              return (
                <Button key={buttonKey} draggable onDragStart={() => handleDragStart(buttonKey)} onDragOver={handleDragOver} onDrop={() => handleDrop(buttonKey)}
                  className="flex items-center justify-center gap-1 bg-gray-800/60 hover:bg-gray-800 text-gray-300 border border-gray-700 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium cursor-grab active:cursor-grabbing opacity-100 hover:opacity-90 transition-opacity flex-1"
                  onClick={config.onClick} data-testid={config.testid}>
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{config.label}</span>
                  <span className="sm:hidden text-xs">{config.label.split(" ")[0]}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
