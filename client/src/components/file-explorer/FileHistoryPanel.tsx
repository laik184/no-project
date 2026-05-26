import { useEffect, useState } from "react";
import { getFileHistory } from "../../services/agent-ultra.service";

interface Props {
  projectId: string;
  filePath: string;
  onSelectForDiff?: (oldText: string, newText: string) => void;
}

export default function FileHistoryPanel({ projectId, filePath, onSelectForDiff }: Props) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const r = await getFileHistory(projectId, filePath);
    setHistory(r?.history || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId, filePath]);

  function sendToDiff(i: number) {
    if (!onSelectForDiff) return;
    const newer = history[i];
    const older = history[i - 1];
    if (!older || !newer) return;
    onSelectForDiff(older.content || "", newer.content || "");
  }

  return (
    <div style={{ marginTop: 12, padding: 10, border: "1px solid #333", borderRadius: 6 }}>
      <h3>File History</h3>
      {loading && <div>Loading...</div>}
      <div style={{ maxHeight: 240, overflow: "auto", fontSize: 12 }}>
        {history.map((h, i) => (
          <div
            key={h.id || i}
            style={{
              padding: 6,
              borderBottom: "1px solid #222",
              cursor: i > 0 ? "pointer" : "default",
            }}
            onClick={() => i > 0 && sendToDiff(i)}
          >
            <div><b>Version:</b> {h.id}</div>
            <div><b>Author:</b>  {h.author}</div>
            <div><b>Time:</b>    {new Date(h.createdAt).toLocaleString()}</div>
            {i > 0 && <div style={{ color: "#0af" }}>Click to diff with previous</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
