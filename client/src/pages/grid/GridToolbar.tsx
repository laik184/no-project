import { Lock, Database, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface GridToolbarProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setGridMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export function GridToolbar({ searchQuery, setSearchQuery, setGridMode }: GridToolbarProps) {
  return (
    <div className="bg-black border-t border-gray-800">
      <div className="px-4 py-3">
        <div className="grid grid-cols-4 gap-3 mb-8">
          <Button variant="outline" className="flex flex-col items-center justify-center gap-2 py-4 bg-gray-800/50 border border-gray-700 hover:bg-gray-700 text-white rounded-xl" data-testid="button-tool-secrets">
            <Lock className="h-6 w-6" />
            <span className="font-medium text-sm">Secrets</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center justify-center gap-2 py-4 bg-gray-800/50 border border-gray-700 hover:bg-gray-700 text-white rounded-xl" data-testid="button-tool-database">
            <Database className="h-6 w-6" />
            <span className="font-medium text-sm">Database</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center justify-center gap-2 py-4 bg-gray-800/50 border border-gray-700 hover:bg-gray-700 text-white rounded-xl" data-testid="button-tool-new-tab">
            <Plus className="h-6 w-6" />
            <span className="font-medium text-sm">New Tab</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 py-3 bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm rounded-xl"
              data-testid="input-search-tools"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400" data-testid="button-search-icon">
              <Search className="h-5 w-5" />
            </button>
          </div>
          <Button variant="ghost" onClick={() => setGridMode(false)}
            className="text-gray-400 hover:text-white hover:bg-gray-700 h-11 w-11 rounded-xl flex-shrink-0 border border-gray-700 bg-gray-800/50"
            data-testid="button-close-tools">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
