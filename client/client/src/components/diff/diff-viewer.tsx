
import React from "react";

interface Props {
  oldText: string;
  newText: string;
}

export default function DiffViewer({ oldText, newText }: Props) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const maxLen = Math.max(oldLines.length, newLines.length);
  const rows = [];

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] || "";
    const newLine = newLines[i] || "";

    let bg = "transparent";
    if (oldLine !== newLine) {
      bg = newLine && !oldLine ? "#143d14" : oldLine && !newLine ? "#3d1414" : "#2c2c14";
    }

    rows.push(
      <tr key={i} style={{ background: bg }}>
        <td style={{ width: "50%", padding: 6, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{oldLine}</td>
        <td style={{ width: "50%", padding: 6, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{newLine}</td>
      </tr>
    );
  }

  return (
    <div style={{ border: "1px solid #333", borderRadius: 8, overflow: "hidden", marginTop: 12 }}>
      <div style={{ display: "flex", background: "#111", color: "#fff" }}>
        <div style={{ flex: 1, padding: 6 }}>Old Version</div>
        <div style={{ flex: 1, padding: 6 }}>New Version</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
