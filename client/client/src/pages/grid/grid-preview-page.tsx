import { Monitor, MoreVertical, ExternalLink, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function GridPreviewPage() {
  const [, setLocation] = useLocation();
  return (
    <div 
      className="flex flex-col h-full cursor-pointer hover:opacity-90 transition-opacity"
      onClick={() => setLocation("/preview")}
    >
      {/* Header */}
      <div className="bg-[#0d0d0d] border-b border-gray-700 px-3 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-gray-400 text-xs font-medium">Publish</span>
            <div className="w-0.5 h-4 bg-gray-600"></div>
            <div className="flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-gray-400" />
              <span className="text-gray-200 text-sm font-medium">Preview</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Browser Bar */}
      <div className="bg-[#0d0d0d] border-b border-gray-700 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded">
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded">
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded">
            <RefreshCw className="h-3 w-3" />
          </Button>
          
          <div className="flex-1 flex items-center gap-2 bg-[#080808] rounded px-2.5 py-1.5 min-w-0">
            <span className="text-gray-500 text-xs truncate">localhost:5000/agent</span>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded hidden sm:flex">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Content - Empty (Real Preview Area) */}
      <main className="flex-1 overflow-auto bg-[#080808]">
        {/* Empty preview area - will show actual app when running */}
      </main>
    </div>
  );
}
