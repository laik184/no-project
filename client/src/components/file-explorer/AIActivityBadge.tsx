type ActivityKind = "creating" | "editing" | "reading" | "analyzing" | "refactoring";

interface AIActivityBadgeProps {
  activity: ActivityKind;
}

const CONFIG: Record<ActivityKind, { label: string; color: string }> = {
  creating:    { label: "Creating",    color: "#60a5fa" },
  editing:     { label: "Editing",     color: "#34d399" },
  reading:     { label: "Reading",     color: "#a78bfa" },
  analyzing:   { label: "Analyzing",   color: "#fbbf24" },
  refactoring: { label: "Refactoring", color: "#f97316" },
};

export function AIActivityBadge({ activity }: AIActivityBadgeProps) {
  const { label, color } = CONFIG[activity] ?? CONFIG.editing;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 9, padding: "1px 5px", borderRadius: 3,
        background: `${color}1a`, color,
        animation: "rfe-pulse 1.2s ease infinite",
        whiteSpace: "nowrap", flexShrink: 0,
      }}
      data-testid={`ai-badge-${activity}`}
    >
      <span style={{
        width: 4, height: 4, borderRadius: "50%",
        background: color, flexShrink: 0,
        animation: "rfe-pulse 0.8s ease infinite",
      }} />
      {label}
    </span>
  );
}
