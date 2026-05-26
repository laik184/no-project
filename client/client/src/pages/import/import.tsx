import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SiGithub, SiFigma } from "react-icons/si";

const importOptions = [
  {
    id: "github",
    title: "Github",
    description: "Import any repository or existing app. Agent may be less predictable.",
    icon: SiGithub,
    iconBg: "bg-[#24292e]",
  },
  {
    id: "figma",
    title: "Figma Design",
    description: "Convert your designs into live Apps using Replit Agent",
    icon: SiFigma,
    iconBg: "bg-gradient-to-br from-[#f24e1e] via-[#a259ff] to-[#1abcfe]",
  },
  {
    id: "lovable",
    title: "Lovable",
    description: "Migrate your site to make it production-ready",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
      </svg>
    ),
    iconBg: "bg-[#ff6b6b]",
  },
  {
    id: "bolt",
    title: "Bolt",
    description: "Migrate your prototype to make it production-ready",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/>
      </svg>
    ),
    iconBg: "bg-[#4a90e2]",
  },
  {
    id: "vercel",
    title: "Vercel",
    description: "Migrate your site to make it production-ready",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M12 2L2 22h20L12 2z"/>
      </svg>
    ),
    iconBg: "bg-black dark:bg-white",
  },
];

export default function ImportPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-[#080808] text-white">
      <header className="sticky top-0 z-50 w-full bg-[#080808] border-b border-[#1a1a1a]">
        <div className="flex h-14 items-center px-4 gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            data-testid="button-back"
            className="text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            onClick={() => setLocation("/")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-semibold text-white mb-3" data-testid="heading-import">
            Import to Replit
          </h1>
          <p className="text-gray-400 text-base mb-8" data-testid="text-description">
            Migrate data, code, and designs from other apps into Replit
          </p>

          <div className="space-y-4">
            {importOptions.map((option) => {
              const Icon = option.icon;
              
              return (
                <button
                  key={option.id}
                  className="w-full flex items-center gap-4 p-5 bg-[#0d0d0d] hover:bg-[#111111] border border-[#1a1a1a] rounded-xl transition-all group"
                  data-testid={`button-import-${option.id}`}
                  onClick={() => {
                    if (option.id === 'github') {
                      setLocation('/import/github');
                    } else if (option.id === 'figma') {
                      setLocation('/import/figma');
                    } else if (option.id === 'lovable') {
                      setLocation('/import/lovable');
                    } else if (option.id === 'bolt') {
                      setLocation('/import/bolt');
                    } else if (option.id === 'vercel') {
                      setLocation('/import/vercel');
                    }
                  }}
                >
                  <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${option.iconBg} flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-medium text-lg mb-1">
                      {option.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {option.description}
                    </p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
