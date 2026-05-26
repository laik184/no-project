
import { useState } from "react";

export default function GitPanel({ projectPath }) {
  const [msg, setMsg] = useState("");

  const gitInit = async () => {
    await fetch("/api/git/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath }),
    });
    alert("Git Initialized");
  };

  const gitCommit = async () => {
    await fetch("/api/git/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath, message: msg }),
    });
    alert("Committed");
  };

  return (
    <div style={{ padding: 10, borderTop: "1px solid #1f2937" }}>
      <button onClick={gitInit}>Git Init</button>
      <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Commit message" />
      <button onClick={gitCommit}>Commit</button>
    </div>
  );
}
