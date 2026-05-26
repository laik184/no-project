import { useState } from "react";
import { ChevronDown, MoreVertical, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppState } from "@/context/app-state-context";
import { useLocation } from "wouter";

export function GridConsolePage() {
  const { consoleOutput } = useAppState();
  const [, setLocation] = useLocation();
  const [workflowExpanded, setWorkflowExpanded] = useState(false);

  return (
    <div 
      className="flex flex-col h-full cursor-pointer hover:opacity-90 transition-opacity"
      onClick={() => setLocation("/console")}
    >
      <div className="sticky top-0 z-50 bg-[#0d0d0d] border-b border-gray-800">
        <div className="flex items-center justify-between px-2 sm:px-4 py-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Terminal className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-500" />
            <h1 className="text-xs sm:text-base font-semibold text-white">Console</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 sm:h-7 sm:w-7 text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 bg-[#0d0d0d] border-b border-gray-800 gap-2 flex-wrap">
        <button className="flex items-center gap-1 text-white hover:text-gray-300 text-xs">
          <span>Workflows</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        <div className="flex items-center gap-1">
          <Switch checked={true} className="data-[state=checked]:bg-blue-600 scale-75" />
          <span className="text-xs text-gray-400 hidden sm:inline">Latest</span>
        </div>
        <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-gray-700 text-xs h-6 px-1.5 sm:px-2 ml-auto">
          Clear
        </Button>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="px-2 sm:px-4 py-2 sm:py-3">
          <div className="bg-[#0d0d0d] rounded-lg border border-gray-800 overflow-hidden">
            <div className="w-full flex items-center justify-between p-2 sm:p-4">
              <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-80" onClick={() => setWorkflowExpanded(!workflowExpanded)}>
                <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0 transition-transform ${workflowExpanded ? 'rotate-180' : ''}`} />
                <span className="text-white text-xs sm:text-base font-mono truncate">npm run dev</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 hover:text-white hover:bg-gray-700">
                  <svg className="h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 bg-red-600 hover:bg-red-700 text-white rounded">
                  <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 bg-white rounded-sm"></div>
                </Button>
              </div>
            </div>
            {workflowExpanded && (
              <div className="border-t border-gray-800 bg-[#080808] p-2 sm:p-4 font-mono text-xs text-gray-300 max-h-[120px] overflow-y-auto">
                <div className="space-y-0.5 sm:space-y-1">
                  {consoleOutput.length > 0 ? (
                    consoleOutput.map((line, idx) => (
                      <div key={idx} className={`${line.includes('✓') ? 'text-green-400' : line.includes('[') ? 'text-blue-400' : 'text-gray-300'}`}>
                        {line}
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="text-green-400">&gt; rest-express@1.0.0 dev</div>
                      <div className="text-green-400">&gt; NODE_ENV=development tsx server/index.ts</div>
                      <div className="text-blue-400 mt-1 sm:mt-2">2:45:07 PM [express] serving on port 5000</div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
