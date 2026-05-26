import { useState } from "react";
import { FolderPlus, Plus, Star, Users, Folder, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Folder as FolderType } from "@shared/schema";

export default function Apps() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);

  const { data: folders = [], isLoading } = useQuery<FolderType[]>({
    queryKey: ["/api/folders"],
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/folders", { name, parentId: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setCreateDialogOpen(false);
      setFolderName("");
      toast({
        title: "Folder created",
        description: "Your folder has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create folder.",
        variant: "destructive",
      });
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest("PATCH", `/api/folders/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setRenameDialogOpen(false);
      setSelectedFolder(null);
      setFolderName("");
      toast({
        title: "Folder renamed",
        description: "Your folder has been renamed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to rename folder.",
        variant: "destructive",
      });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setDeleteDialogOpen(false);
      setSelectedFolder(null);
      toast({
        title: "Folder deleted",
        description: "Your folder has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete folder.",
        variant: "destructive",
      });
    },
  });

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      createFolderMutation.mutate(folderName.trim());
    }
  };

  const handleRenameFolder = () => {
    if (selectedFolder && folderName.trim()) {
      renameFolderMutation.mutate({ id: String(selectedFolder.id), name: folderName.trim() });
    }
  };

  const handleDeleteFolder = () => {
    if (selectedFolder) {
      deleteFolderMutation.mutate(String(selectedFolder.id));
    }
  };

  const openRenameDialog = (folder: FolderType) => {
    setSelectedFolder(folder);
    setFolderName(folder.name);
    setRenameDialogOpen(true);
  };

  const openDeleteDialog = (folder: FolderType) => {
    setSelectedFolder(folder);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold" data-testid="text-apps-title">Apps</h1>
            <span className="text-sm text-muted-foreground" data-testid="text-apps-count">(1/10) Apps</span>
          </div>
        </div>
        <Button data-testid="button-create" className="gap-2">
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm" data-testid="text-breadcrumb">All /</span>
          </div>
          <Button variant="ghost" size="icon" data-testid="button-star">
            <Star className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4 mb-6">
          <Button 
            variant="outline" 
            className="flex items-center gap-2 bg-card hover:bg-accent"
            onClick={() => setCreateDialogOpen(true)}
            data-testid="button-new-folder"
          >
            <FolderPlus className="h-5 w-5" />
            New folder
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-sm font-medium" data-testid="text-shared-section">Shared with me</h2>
            </div>

            {isLoading ? (
              <Card className="border-2 border-dashed border-border bg-transparent p-12">
                <div className="text-center text-muted-foreground">Loading...</div>
              </Card>
            ) : folders.length > 0 ? (
              <div className="space-y-2">
                {folders.map((folder) => (
                  <Card key={folder.id} className="p-4" data-testid={`folder-${folder.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Folder className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium" data-testid={`folder-name-${folder.id}`}>{folder.name}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`folder-menu-${folder.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openRenameDialog(folder)} data-testid={`folder-rename-${folder.id}`}>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem data-testid={`folder-move-${folder.id}`}>
                            Move
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => openDeleteDialog(folder)} 
                            className="text-destructive"
                            data-testid={`folder-delete-${folder.id}`}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-2 border-dashed border-border bg-transparent p-12">
                <div className="flex flex-col items-center justify-center gap-6 text-center">
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                    data-testid="button-new-app"
                  >
                    <Plus className="h-5 w-5" />
                    New App
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-create-folder">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-3xl font-semibold">Create folder</DialogTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCreateDialogOpen(false)}
                data-testid="button-close-dialog"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Title</Label>
              <Input
                id="folder-name"
                placeholder="Name your folder"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                data-testid="input-folder-name"
                className="h-12"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="secondary" 
              onClick={() => setCreateDialogOpen(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateFolder}
              disabled={!folderName.trim() || createFolderMutation.isPending}
              data-testid="button-create-folder"
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" />
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-rename-folder">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-3xl font-semibold">Rename folder</DialogTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setRenameDialogOpen(false)}
                data-testid="button-close-rename-dialog"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-folder-name">Title</Label>
              <Input
                id="rename-folder-name"
                placeholder="Name your folder"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
                data-testid="input-rename-folder-name"
                className="h-12"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="secondary" 
              onClick={() => setRenameDialogOpen(false)}
              data-testid="button-cancel-rename"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRenameFolder}
              disabled={!folderName.trim() || renameFolderMutation.isPending}
              data-testid="button-save-rename"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-folder">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the folder "{selectedFolder?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteFolder}
              disabled={deleteFolderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
