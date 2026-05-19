/**
 * IQ 2000 — Console · ConsoleLine
 *
 * Renders a single log line with:
 *  - ANSI color support
 *  - Kind badge (stderr, system, error)
 *  - Timestamp (hover-revealed)
 *  - Stack trace highlighting
 *  - npm / vite meta badges
 */

import React, { memo } from "react";
import { parseAnsi } from "./ansi-utils";
import type { ConsoleLineMeta } from "@/types/console";

export interface LogLine {
  id:    string;
  kind:  "stdout" | "stderr" | "system" | "error";
  text:  string;
  ts:    string;
  meta?: ConsoleLineMeta;
}

interface Props {
  line:    LogLine;
  search?: string;
}

// Per-kind base colors
const KIND_COLOR: Record<LogLine["kind"], string> = {
  stdout: "rgba(180,255,200,0.88)",
  stderr: "#ff7b7b",
  error:  "#ff5555",
  system: "rgba(120,160,255,0.75)",
};

const KIND_PREFIX: Record<LogLine["kind"], string> = {
  stdout: "",
  stderr: "! ",
  error:  "✕ ",
  system: "» ",
};

function MetaBadge({ meta }: { meta: ConsoleLineMeta }) {
  if (meta.vite?.type === "ready") {
    return (
      <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 5px", borderRadius: 3,
        background: "rgba(99,235,123,0.18)", color: "#6bcb77", verticalAlign: "middle" }}>
        ready
      </span>
    );
  }
  if (meta.vite?.type === "hmr") {
    return (
      <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 5px", borderRadius: 3,
        background: "rgba(77,157,224,0.18)", color: "#4d9de0", verticalAlign: "middle" }}>
        HMR
      </span>
    );
  }
  if (meta.npm?.type === "install-done") {
    const pkgs = meta.npm.packages;
    return (
      <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 5px", borderRadius: 3,
        background: "rgba(255,217,61,0.18)", color: "#ffd93d", verticalAlign: "middle" }}>
        {pkgs ? `${pkgs} pkgs` : "installed"}
      </span>
    );
  }
  if (meta.npm?.vulnerabilities && meta.npm.vulnerabilities > 0) {
    return (
      <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 5px", borderRadius: 3,
        background: "rgba(255,85,85,0.18)", color: "#ff5555", verticalAlign: "middle" }}>
        {meta.npm.vulnerabilities} vuln
      </span>
    );
  }
  return null;
}

function highlightSearch(text: string, search: string) {
  if (!search) return text;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(255,217,61,0.35)", color: "inherit", borderRadius: 2 }}>
        {text.slice(idx, idx + search.length)}
      </mark>
      {text.slice(idx + search.length)}
    </>
  );
}

export const ConsoleLine = memo(function ConsoleLine({ line, search }: Props) {
  const segments = parseAnsi(line.text);
  const isStack  = line.meta?.node?.type === "stack-trace";
  const color    = KIND_COLOR[line.kind];
  const prefix   = KIND_PREFIX[line.kind];
  const time     = line.ts ? new Date(line.ts).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

  return (
    <div
      className="group flex items-start gap-1.5 px-1 py-px rounded-sm hover:bg-white/[0.03] transition-colors"
      style={{ opacity: isStack ? 0.7 : 1 }}
    >
      {/* Timestamp — visible on hover */}
      <span
        className="flex-shrink-0 text-[10px] leading-5 select-none opacity-0 group-hover:opacity-40 transition-opacity"
        style={{ color: "rgba(255,255,255,0.5)", minWidth: 52, fontVariantNumeric: "tabular-nums" }}
      >
        {time}
      </span>

      {/* Kind prefix */}
      {prefix && (
        <span className="flex-shrink-0 text-xs leading-5 select-none" style={{ color }}>
          {prefix}
        </span>
      )}

      {/* ANSI-colored text */}
      <span className="text-xs leading-5 break-all min-w-0 flex-1" style={{ color }}>
        {segments.map((seg, i) => {
          const content = search ? highlightSearch(seg.text, search) : seg.text;
          return Object.keys(seg.style).length > 0
            ? <span key={i} style={seg.style}>{content}</span>
            : <React.Fragment key={i}>{content}</React.Fragment>;
        })}

        {/* Meta badge inline */}
        {line.meta && <MetaBadge meta={line.meta} />}
      </span>
    </div>
  );
});
