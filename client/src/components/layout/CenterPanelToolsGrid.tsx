import { toolItems } from "./center-panel-tools";

interface CenterPanelToolsGridProps {
  onToolSelect: (label: string, url: string) => void;
}

export function CenterPanelToolsGrid({ onToolSelect }: CenterPanelToolsGridProps) {
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "rgba(255,255,255,0.006)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.022) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="relative py-8 px-6 w-full">
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {toolItems.map((section) => (
            <div key={section.section} className="mb-7">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(148,163,184,0.38)" }}>
                {section.section}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onToolSelect(item.label, item.url)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group transition-all duration-200"
                      style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.07)" }}
                      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.border = "1px solid rgba(124,141,255,0.28)"; el.style.background = "rgba(124,141,255,0.055)"; el.style.transform = "translateY(-1px)"; el.style.boxShadow = "0 4px 16px rgba(124,141,255,0.08)"; }}
                      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.border = "1px solid rgba(255,255,255,0.07)"; el.style.background = "rgba(255,255,255,0.028)"; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}
                      data-testid={`button-newtab-tool-${item.id}`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: item.bg }}>
                        <Icon style={{ width: 15, height: 15, color: item.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors mb-0.5 truncate">{item.label}</p>
                        <p className="text-[10.5px] leading-snug line-clamp-2" style={{ color: "rgba(148,163,184,0.48)" }}>{item.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
