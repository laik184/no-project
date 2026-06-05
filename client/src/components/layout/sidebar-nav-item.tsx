import { Link } from "wouter";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface NavItemProps {
  item: { title: string; icon: React.ElementType; url: string };
  collapsed: boolean;
  active: boolean;
}

export function NavItem({ item, collapsed, active }: NavItemProps) {
  const Icon = item.icon;

  const inner = (
    <Link href={item.url}>
      <div
        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group relative",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        )}
      >
        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full neon-glow-blue" />}
        <Icon className={cn("flex-shrink-0 transition-all duration-200", collapsed ? "h-5 w-5" : "h-4 w-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        {!collapsed && <span className="text-sm font-medium truncate">{item.title}</span>}
        {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary neon-glow-blue" />}
      </div>
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="ml-2 glass border-white/10 text-foreground">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}
