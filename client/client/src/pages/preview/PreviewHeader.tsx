import { Monitor, MoreVertical, Settings, Keyboard, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface PreviewHeaderProps {
  crashReason: string | null;
  lastAction: string | null;
  lastReloadType: "hot" | "hard" | null;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}

export function PreviewHeader({ crashReason, lastAction, lastReloadType, menuOpen, setMenuOpen }: PreviewHeaderProps) {
  return (
    <header className="bg-black border-b border-gray-800 px-3 sm:px-4 py-2.5 sm:py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {crashReason && (
            <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">{crashReason}</span>
          )}
          {lastAction && (
            <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">{lastAction}</span>
          )}
          {lastReloadType && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${lastReloadType === "hot" ? "bg-green-600 text-white" : "bg-yellow-500 text-black"}`}>
              {lastReloadType === "hot" ? "Hot Reload" : "Server Restart"}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs font-medium">Publish</span>
          </div>
          <div className="w-0.5 h-4 bg-gray-600"></div>
          <div className="flex items-center gap-1.5">
            <Monitor className="h-4 w-4 text-gray-400" />
            <span className="text-gray-200 text-sm font-medium">Preview</span>
          </div>
        </div>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg" data-testid="button-menu">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem data-testid="menu-settings">
              <Settings className="h-4 w-4 mr-2" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="menu-keyboard">
              <Keyboard className="h-4 w-4 mr-2" />
              <span>Keyboard Shortcuts</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="menu-help">
              <HelpCircle className="h-4 w-4 mr-2" />
              <span>Help & Support</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
