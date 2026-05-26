import { useState, useRef, useEffect } from "react";

interface InlineInputProps {
  initialValue?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function InlineInput({ initialValue = "", onConfirm, onCancel }: InlineInputProps) {
  const [val, setVal] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.select(); }, []);

  return (
    <input
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter")  { e.preventDefault(); if (val.trim()) onConfirm(val.trim()); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      onBlur={() => { if (val.trim()) onConfirm(val.trim()); else onCancel(); }}
      className="flex-1 min-w-0 rounded px-1.5 py-0.5 text-[11.5px] outline-none"
      style={{
        background: "rgba(124,141,255,0.12)",
        border: "1px solid rgba(124,141,255,0.35)",
        color: "rgba(226,232,240,0.95)",
      }}
      autoFocus
      data-testid="input-file-rename"
    />
  );
}

interface ActionIconProps {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  danger?: boolean;
  testId?: string;
}

export function ActionIcon({ children, onClick, title, danger = false, testId }: ActionIconProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testId}
      className="w-4 h-4 flex items-center justify-center rounded transition-colors"
      style={{ color: danger ? "rgba(248,113,113,0.6)" : "rgba(148,163,184,0.5)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = danger
          ? "rgba(239,68,68,0.12)"
          : "rgba(255,255,255,0.08)";
        (e.currentTarget as HTMLElement).style.color = danger ? "#f87171" : "rgba(226,232,240,0.8)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = danger
          ? "rgba(248,113,113,0.6)"
          : "rgba(148,163,184,0.5)";
      }}
    >
      {children}
    </button>
  );
}
