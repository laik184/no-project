import { X, ChevronLeft, ChevronRight, Monitor, BookOpen, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebarDrawer } from "@/components/panels/sidebar-drawer-context";

export function SidebarDrawer() {
  const { isOpen, currentPage, position, closeDrawer, togglePosition } = useSidebarDrawer();

  const pageInfo: Record<string, { title: string; icon: React.ElementType }> = {
    preview:   { title: "Preview",   icon: Monitor   },
    published: { title: "Published", icon: BookOpen  },
    console:   { title: "Console",   icon: Terminal  },
  };

  const currentInfo  = currentPage ? pageInfo[currentPage] : null;
  const CurrentIcon  = currentInfo?.icon;

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={closeDrawer} />}
      <div
        className={`fixed top-0 bottom-0 z-50 w-full sm:w-96 bg-[#080808] border-gray-800 transition-all duration-300 ${
          position === "left" ? "border-r left-0" : "border-l right-0"
        } ${
          isOpen ? "translate-x-0" : position === "left" ? "-translate-x-full" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0d0d0d]">
          <div className="flex items-center gap-2">
            {CurrentIcon && <CurrentIcon className="h-4 w-4 text-white" />}
            <h2 className="text-white font-semibold">{currentInfo?.title || ""}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white" onClick={togglePosition} data-testid="button-swap-sidebar">
              {position === "left" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white" onClick={closeDrawer} data-testid="button-close-sidebar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="h-[calc(100%-49px)] overflow-auto text-white p-4">
          {currentPage === "preview"   && <div>Preview content coming soon</div>}
          {currentPage === "published" && <div>Published content coming soon</div>}
          {currentPage === "console"   && <div>Console content coming soon</div>}
        </div>
      </div>
    </>
  );
}
