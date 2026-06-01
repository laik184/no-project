import { useState, useRef, useEffect } from "react";
import { Plus, Paperclip, ImageIcon } from "lucide-react";

export function UploadPopup() {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const handler = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setShow(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [show]);

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
    const fd = new FormData();
    fd.append("projectId", String(projectId));
    Array.from(fileList).forEach((f) => fd.append("files", f));
    try { await fetch("/api/chat/upload", { method: "POST", body: fd }); } catch {}
    e.target.value = "";
    setShow(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setShow((v) => !v)}
        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
        data-testid="button-chat-add"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {show && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 overflow-hidden"
          style={{ width: 175, background: "#0B0F14", border: "1px solid #263244", borderRadius: 12, boxShadow: "0 -4px 32px rgba(0,0,0,0.5)" }}
        >
          <label
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-xs hover:bg-white/6 transition-colors cursor-pointer"
            style={{ color: "#94A3B8" }}
            data-testid="button-chat-popup-upload-file"
          >
            <input type="file" multiple accept=".pdf,.zip,.tar,.gz,.txt,.csv,.json,.md" className="hidden" onChange={handleFilesChange} />
            <Paperclip className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#3B82F6" }} />
            <span>Upload File</span>
          </label>
          <div style={{ height: 1, background: "#263244", margin: "0 12px" }} />
          <label
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-xs hover:bg-white/6 transition-colors cursor-pointer"
            style={{ color: "#94A3B8" }}
            data-testid="button-chat-popup-upload-photo"
          >
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChange} />
            <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#94A3B8" }} />
            <span>Upload Photo</span>
          </label>
        </div>
      )}
    </div>
  );
}
