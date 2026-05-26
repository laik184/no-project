import { useToast } from "@/hooks/use-toast";

export function useFileActions(onSuccess: () => void, setIsLoading: (v: boolean) => void) {
  const { toast } = useToast();

  const handleNewFile = async () => {
    const fileName = prompt("Enter file name:");
    if (!fileName) return;
    try {
      const response = await fetch("/api/files/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, isFolder: false }),
      });
      if (response.ok) {
        toast({ title: "Success", description: `File ${fileName} created successfully` });
        onSuccess();
      }
    } catch {
      toast({ title: "Error", description: "Failed to create file", variant: "destructive" });
    }
  };

  const handleNewFolder = async () => {
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;
    try {
      const response = await fetch("/api/files/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: folderName, isFolder: true }),
      });
      if (response.ok) {
        toast({ title: "Success", description: `Folder ${folderName} created successfully` });
        onSuccess();
      }
    } catch {
      toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
    }
  };

  const handleUploadFiles = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async (e: Event) => {
      const uploadedFiles = Array.from((e.target as HTMLInputElement).files ?? []);
      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          const response = await fetch("/api/files/upload", { method: "POST", body: formData });
          if (!response.ok) throw new Error("Upload failed");
        } catch {
          toast({ title: "Error", description: `Failed to upload ${file.name}`, variant: "destructive" });
        }
      }
      toast({ title: "Success", description: `${uploadedFiles.length} file(s) uploaded successfully` });
      onSuccess();
    };
    input.click();
  };

  const handleDownloadZip = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/files/download");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-files.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Success", description: "Project downloaded successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to download files", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (filePath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Delete ${filePath}?`)) return;
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(filePath)}`, { method: "DELETE" });
      if (response.ok) {
        toast({ title: "Success", description: "File/folder deleted successfully" });
        onSuccess();
      } else {
        const errorData = await response.json();
        toast({ title: "Error", description: errorData.error || "Failed to delete file/folder", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete file/folder", variant: "destructive" });
    }
  };

  return { handleNewFile, handleNewFolder, handleUploadFiles, handleDownloadZip, handleDeleteFile };
}
