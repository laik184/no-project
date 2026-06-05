import { XCircle, AlertTriangle } from "lucide-react";

interface ManageShutdownModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function ManageShutdownModal({ onCancel, onConfirm }: ManageShutdownModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "hsl(222,30%,7%)",
          border: "1px solid rgba(248,113,113,0.25)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          maxWidth: "380px",
          width: "100%",
          animation: "modal-in 0.22s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)" }}>
              <XCircle className="h-5 w-5" style={{ color: "#f87171" }} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold" style={{ color: "rgba(226,232,240,0.95)" }}>Shutdown App?</h3>
              <p className="text-[11px]" style={{ color: "rgba(100,116,139,0.6)" }}>This action requires confirmation</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
            <p className="text-[12px] leading-relaxed" style={{ color: "#fca5a5" }}>
              <strong>This will stop your app and make it unavailable</strong> to all users until it is restarted or redeployed.
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12px]" style={{ color: "rgba(148,163,184,0.7)" }}>
            Are you sure you want to shut down <span className="font-mono font-semibold" style={{ color: "rgba(226,232,240,0.85)" }}>nura-x-app.replit.app</span>?
          </p>
        </div>
        <div className="flex items-center gap-2.5 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(203,213,225,0.8)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            data-testid="button-cancel-shutdown"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12.5px] font-semibold transition-all duration-150"
            style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.35)", color: "#f87171" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.25)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.15)"; }}
            data-testid="button-confirm-shutdown"
          >
            <XCircle className="h-3.5 w-3.5" />
            Yes, shut down
          </button>
        </div>
      </div>
    </div>
  );
}
