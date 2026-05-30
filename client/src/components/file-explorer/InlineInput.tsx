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
      style={{
        flex: 1, minWidth: 0,
        padding: "1px 5px", borderRadius: 3,
        background: "#141414",
        border: "1px solid #3b82f6",
        color: "#e4e4e7",
        fontSize: 12,
        outline: "none",
        boxShadow: "0 0 0 2px rgba(59,130,246,.2)",
        fontFamily: "inherit",
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
      style={{
        width: 20, height: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent", border: "none", cursor: "pointer",
        borderRadius: 3,
        color: danger ? "rgba(248,113,113,.55)" : "#555",
        transition: "background .1s, color .1s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = danger ? "rgba(239,68,68,.12)" : "#2e2e2e";
        el.style.color      = danger ? "#ef4444" : "#c4c4c4";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "transparent";
        el.style.color      = danger ? "rgba(248,113,113,.55)" : "#555";
      }}
    >
      {children}
    </button>
  );
}
