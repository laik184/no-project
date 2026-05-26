import { X, Lock, Database, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebarDrawer } from "@/components/panels/sidebar-drawer-context";
import { useState } from "react";

export function ToolsDrawer() {
  const { toolsOpen, closeTools } = useSidebarDrawer();
  const [searchQuery, setSearchQuery] = useState("");

  const tools = [
    { id: "secrets",  label: "Secrets",  icon: Lock     },
    { id: "database", label: "Database", icon: Database },
  ];

  return (
    <>
      {toolsOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={closeTools} />}
      <div className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#080808] border-r border-gray-800 transition-all duration-300 ${toolsOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0d0d0d]">
          <h2 className="text-white font-semibold">Tools</h2>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white" onClick={closeTools} data-testid="button-close-tools">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-[calc(100%-49px)] overflow-auto flex flex-col">
          <div className="flex-1 p-4">
            <div className="space-y-2 mb-4">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Button key={tool.id} variant="outline" className="w-full justify-start gap-3 h-12 text-white border-gray-700 hover:bg-gray-800 hover:border-gray-600" data-testid={`button-tool-${tool.id}`}>
                    <Icon className="h-5 w-5" />
                    <span>{tool.label}</span>
                  </Button>
                );
              })}
            </div>
            <Button variant="outline" className="w-full justify-start gap-3 h-12 text-white border-gray-700 hover:bg-gray-800 hover:border-gray-600" data-testid="button-new-tab">
              <Plus className="h-5 w-5" />
              <span>New Tab</span>
            </Button>
          </div>
          <div className="p-4 border-t border-gray-800 bg-[#0d0d0d]">
            <div className="relative">
              <Input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" data-testid="input-search-tools" />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
