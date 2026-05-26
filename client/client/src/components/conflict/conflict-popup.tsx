
import React from "react";

interface Props {
  visible: boolean;
  onReload: () => void;
  onForce: () => void;
  onCancel: () => void;
}

export default function ConflictPopup({ visible, onReload, onForce, onCancel }: Props) {
  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div style={{ background: "#111", padding: 20, borderRadius: 10, width: 400 }}>
        <h3 style={{ color: "red" }}>⚠️ Conflict Detected</h3>
        <p>यह file किसी और process द्वारा बदल दी गई है।</p>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button onClick={onReload}>Reload Latest</button>
          <button onClick={onForce}>Force Override</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
