import React from "react";
import type { DeviceKey } from "./preview-types";

/* ───────────────────────── DEVICE FRAME WRAPPER ───────────────────────────── */
export function DeviceFrame({ deviceKey, children }: { deviceKey: DeviceKey; children: React.ReactNode }) {
  if (deviceKey === "oneplus" as DeviceKey) return <OnePlusFrame>{children}</OnePlusFrame>;
  return <MobileFrame>{children}</MobileFrame>;
}

/* ───────────────────────────── TABLET 16:9 FRAME ───────────────────────────── */
export function TabletFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "relative", width: "800px", height: "450px",
      filter: ["drop-shadow(0 50px 100px rgba(0,0,0,0.98))", "drop-shadow(0 20px 40px rgba(0,0,0,0.80))", "drop-shadow(0 4px 10px rgba(0,0,0,0.60))"].join(" "),
    }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "44px",
        background: ["linear-gradient(180deg,", "  #484848 0%,", "  #323232 8%,", "  #242424 22%,", "  #191919 45%,", "  #111111 72%,", "  #0a0a0a 88%,", "  #060606 100%", ")"].join(""),
      }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "44px", boxShadow: "0 0 0 1px rgba(0,0,0,1)" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "44px", boxShadow: ["inset 0 1.5px 0 rgba(255,255,255,0.20)", "inset 0 -1.5px 0 rgba(0,0,0,0.90)"].join(", ") }} />
      <div style={{ position: "absolute", left: 0, top: "14px", bottom: "14px", width: "5px", borderRadius: "5px 0 0 5px", background: "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.72) 50%, rgba(0,0,0,0.05))" }} />
      <div style={{ position: "absolute", right: 0, top: "14px", bottom: "14px", width: "4px", borderRadius: "0 4px 4px 0", background: "linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.02))" }} />
      <div style={{ position: "absolute", right: "2px", top: "28px", bottom: "28px", width: "1px", background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.30) 50%, transparent)" }} />
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "40px",
        borderRadius: "44px 44px 0 0",
        background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
      }}>
        <div style={{
          position: "relative", marginTop: "3px", width: "16px", height: "16px", borderRadius: "50%",
          background: "linear-gradient(145deg, #1a1a1a 0%, #050505 100%)",
          boxShadow: ["0 0 0 2px rgba(255,255,255,0.30)", "0 0 0 3.5px rgba(255,255,255,0.08)", "0 0 0 4.5px rgba(0,0,0,0.6)", "inset 0 2px 6px rgba(0,0,0,1)", "inset 0 -1px 3px rgba(0,0,0,0.95)"].join(", "),
        }}>
          <div style={{ position: "absolute", inset: "3px", borderRadius: "50%", background: "#000" }} />
          <div style={{ position: "absolute", top: "3px", left: "4px", width: "4px", height: "3px", borderRadius: "50%", background: "rgba(255,255,255,0.50)" }} />
        </div>
        <div style={{ position: "absolute", bottom: 0, left: "18px", right: "18px", height: "3px", background: "linear-gradient(to right, transparent, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, transparent)", filter: "blur(1.5px)" }} />
      </div>
      <div style={{
        position: "absolute", top: "38px", left: "16px", right: "16px", bottom: "16px",
        borderRadius: "30px", overflow: "hidden", background: "#000",
        boxShadow: ["inset 0 4px 14px rgba(0,0,0,1)", "inset 0 -3px 8px rgba(0,0,0,0.90)", "inset 4px 0 8px rgba(0,0,0,0.80)", "inset -4px 0 8px rgba(0,0,0,0.80)"].join(", "),
      }}>
        {children}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(125deg, rgba(255,255,255,0.050) 0%, rgba(255,255,255,0.012) 30%, transparent 52%)" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "30px", boxShadow: "inset 0 0 22px rgba(0,0,0,0.40)" }} />
      </div>
      <div style={{ position: "absolute", top: "1px", left: "24px", right: "24px", height: "1px", background: "linear-gradient(to right, transparent, rgba(255,255,255,0.26) 22%, rgba(255,255,255,0.26) 78%, transparent)" }} />
      <div style={{ position: "absolute", bottom: "5px", left: "50px", right: "50px", height: "8px", borderRadius: "50%", background: "linear-gradient(to right, transparent, rgba(0,0,0,0.85) 28%, rgba(0,0,0,0.85) 72%, transparent)", filter: "blur(4px)" }} />
    </div>
  );
}

/* ─────────────────────── ONEPLUS PAD GO 2 FRAME (7:5 landscape) ─────────────────────── */
export function OnePlusFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "relative", width: "840px", height: "600px",
      display: "flex", alignItems: "center", justifyContent: "center",
      filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.92)) drop-shadow(0 6px 20px rgba(0,0,0,0.65))",
    }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "22px",
        background: "linear-gradient(160deg, #2e2e2e 0%, #1a1a1a 40%, #111111 70%, #0c0c0c 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -1px 0 rgba(0,0,0,0.7), inset -1px 0 3px rgba(255,255,255,0.04), inset 1px 0 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.9)",
      }} />
      <div style={{ position: "absolute", left: "0px", top: "22px", bottom: "22px", width: "2px", background: "linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02))" }} />
      <div style={{ position: "absolute", right: "0px", top: "22px", bottom: "22px", width: "2px", background: "linear-gradient(to bottom, rgba(255,255,255,0.03), rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.03))" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "32px", borderRadius: "22px 22px 0 0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
        <div style={{ position: "relative", width: "8px", height: "8px", borderRadius: "50%", background: "radial-gradient(circle at 33% 33%, #232323, #060606)", boxShadow: "0 0 0 2px rgba(255,255,255,0.07), 0 0 0 3.5px rgba(255,255,255,0.03), inset 0 1px 3px rgba(0,0,0,1)" }}>
          <div style={{ position: "absolute", top: "2px", left: "2px", width: "2.5px", height: "2.5px", borderRadius: "50%", background: "rgba(255,255,255,0.4)" }} />
        </div>
        <div style={{ position: "absolute", bottom: 0, left: "22px", right: "22px", height: "1px", background: "linear-gradient(to right, transparent, rgba(0,0,0,0.5) 25%, rgba(0,0,0,0.5) 75%, transparent)" }} />
      </div>
      <div style={{ position: "absolute", top: "30px", left: "15px", right: "15px", bottom: "15px", borderRadius: "7px", overflow: "hidden", background: "#000", boxShadow: "inset 0 3px 8px rgba(0,0,0,1), inset 0 -2px 5px rgba(0,0,0,0.8), inset 2px 0 5px rgba(0,0,0,0.7), inset -2px 0 5px rgba(0,0,0,0.7)" }}>
        {children}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.035) 0%, transparent 45%)", pointerEvents: "none" }} />
      </div>
      <div style={{ position: "absolute", bottom: "5px", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "3px", opacity: 0.18 }}>
        <span style={{ color: "#fff", fontSize: "7px", fontFamily: "sans-serif", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>OnePlus</span>
      </div>
      <div style={{ position: "absolute", top: "1px", left: "22px", right: "22px", height: "1px", background: "linear-gradient(to right, transparent, rgba(255,255,255,0.14) 30%, rgba(255,255,255,0.14) 70%, transparent)" }} />
      <div style={{ position: "absolute", bottom: "3px", left: "40px", right: "40px", height: "5px", background: "linear-gradient(to right, transparent, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.6) 70%, transparent)", filter: "blur(3px)" }} />
    </div>
  );
}

/* ─────────────────────────── MOBILE FRAME ─────────────────────────── */
export function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "relative", width: "390px", height: "844px",
      display: "flex", alignItems: "center", justifyContent: "center",
      filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.85))",
    }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "48px",
        background: "linear-gradient(165deg, #3a3a3a 0%, #1e1e1e 50%, #0d0d0d 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.8)",
      }} />
      <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", width: "120px", height: "34px", borderRadius: "20px", background: "#000", zIndex: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.6)" }} />
      <div style={{ position: "absolute", top: "12px", left: "12px", right: "12px", bottom: "12px", borderRadius: "38px", overflow: "hidden", background: "#000", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.8)" }}>
        {children}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(130deg, rgba(255,255,255,0.04) 0%, transparent 50%)", pointerEvents: "none", borderRadius: "38px" }} />
      </div>
      <div style={{ position: "absolute", top: "1px", left: "40px", right: "40px", height: "1px", background: "linear-gradient(to right, transparent, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.15) 70%, transparent)" }} />
    </div>
  );
}
