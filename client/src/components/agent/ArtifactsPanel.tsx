import React from "react";
import { useArtifacts } from "../hooks/useArtifacts";

export default function ArtifactsPanel() {
  const { artifacts, loading, error } = useArtifacts();

  if (loading) return <div><h3>Artifacts</h3><p>Loading...</p></div>;
  if (error) return <div><h3>Artifacts</h3><p style={{color:'red'}}>{error}</p></div>;

  return (
    <div>
      <h3>Artifacts</h3>
      {artifacts.length === 0 && <p>No artifacts yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {artifacts.map(a => (
          <li key={a.id} style={{ marginBottom: 8 }}>
            <div>
              <strong>{a.name}</strong>{" "}
              <span style={{ color: "#666" }}>({a.type})</span>
            </div>
            <a href={a.url} download>
              Download
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}