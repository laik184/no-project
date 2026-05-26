
import { useState } from "react";

export default function ProjectPanel({ projectPath }) {
  const [name, setName] = useState("");

  const save = async () => {
    await fetch("/api/project/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectPath })
    });
    alert("Project Saved to Cloud Store");
  };

  const load = async () => {
    await fetch("/api/project/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectPath })
    });
    alert("Project Loaded from Cloud Store");
    window.location.reload();
  };

  return (
    <div style={{ padding: 10, borderTop: "1px solid #1f2937" }}>
      <input
        placeholder="Project name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <button onClick={save}>Save</button>
      <button onClick={load}>Load</button>
    </div>
  );
}
