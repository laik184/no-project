import React from "react";
import { useTimeline } from "../hooks/useTimeline";

export default function TimelinePanel() {
  const { events, loading, error } = useTimeline();

  if (loading) return <div><h3>Timeline</h3><p>Loading...</p></div>;
  if (error) return <div><h3>Timeline</h3><p style={{color:'red'}}>{error}</p></div>;

  return (
    <div>
      <h3>Timeline</h3>
      {events.length === 0 && <p>No events yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {events.map(ev => (
          <li key={ev.id} style={{ marginBottom: 8 }}>
            <div>
              <strong>{ev.type}</strong>{" "}
              <span style={{ color: "#666" }}>
                {new Date(ev.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div>{ev.message}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}