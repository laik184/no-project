import { useRef } from "react";

export const RELOAD_DEBOUNCE_MS = 2500;

export type DeviceKey = "fullsize";

export interface DeviceConfig {
  label: string;
  width: string | null;
  height: string | null;
  frame: "none" | "phone" | "tablet";
  dims?: string;
}

export const DEVICE_CONFIGS: Record<DeviceKey, DeviceConfig> = {
  "fullsize": { label: "Full size", width: null, height: null, frame: "none" },
};

export const DEVICE_GROUPS: { groupLabel: string; keys: DeviceKey[] }[] = [
  { groupLabel: "General", keys: ["fullsize"] },
];

export function usePreviewGuard() {
  const lastReload = useRef(0);

  const safeReload = (reload: () => void) => {
    const now = Date.now();
    if (now - lastReload.current > RELOAD_DEBOUNCE_MS) {
      lastReload.current = now;
      reload();
    }
  };

  return { safeReload };
}

export type DeviceType = "desktop" | "iphone" | "ipad" | "android";
export type DevToolsTab = "console" | "elements" | "network";
