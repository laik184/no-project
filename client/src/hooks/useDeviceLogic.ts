import { useState, useRef, useEffect } from "react";
import { DEVICE_CONFIGS, type DeviceKey, type DeviceType } from "@/pages/preview/preview-types";

export function useDeviceLogic() {
  const [selectedDevice, setSelectedDevice] = useState<DeviceKey>("fullsize");
  const [showDevicePopup, setShowDevicePopup] = useState(false);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");
  const devicePopupRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const dragTypeRef = useRef<"right" | "bottom" | "corner" | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartWRef = useRef(0);
  const dragStartHRef = useRef(0);

  useEffect(() => {
    if (!showDevicePopup) return;
    const handler = (e: MouseEvent) => {
      if (devicePopupRef.current && !devicePopupRef.current.contains(e.target as Node)) {
        setShowDevicePopup(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDevicePopup]);

  const handleSelectDevice = (key: DeviceKey) => {
    setSelectedDevice(key);
    setShowDevicePopup(false);
    const cfg = DEVICE_CONFIGS[key];
    if (key === "fullsize") {
      setDeviceType("desktop");
      setCustomWidth(null);
      setCustomHeight(null);
    } else if (cfg.frame === "tablet") {
      setDeviceType("desktop");
      setCustomWidth(null);
      setCustomHeight(null);
    } else if (cfg.frame === "phone") {
      setDeviceType("iphone");
      setCustomWidth(null);
      setCustomHeight(null);
    } else {
      setDeviceType("desktop");
      setCustomWidth(cfg.width ? parseInt(cfg.width) : null);
      setCustomHeight(cfg.height ? parseInt(cfg.height) : null);
    }
  };

  const handleResizeDragStart = (e: React.MouseEvent, type: "right" | "bottom" | "corner") => {
    e.preventDefault();
    const container = previewContainerRef.current;
    if (!container) return;
    dragTypeRef.current = type;
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    dragStartWRef.current = customWidth ?? container.offsetWidth;
    dragStartHRef.current = customHeight ?? container.offsetHeight;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartXRef.current;
      const dy = ev.clientY - dragStartYRef.current;
      if (dragTypeRef.current === "right" || dragTypeRef.current === "corner") {
        setCustomWidth(Math.max(280, dragStartWRef.current + dx));
      }
      if (dragTypeRef.current === "bottom" || dragTypeRef.current === "corner") {
        setCustomHeight(Math.max(200, dragStartHRef.current + dy));
      }
    };
    const onUp = () => {
      dragTypeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const getDeviceStyles = () => {
    const cfg = DEVICE_CONFIGS[selectedDevice];
    if (cfg?.width && cfg?.height && selectedDevice !== "fullsize" && selectedDevice !== "16:9") {
      return { width: cfg.width, height: cfg.height };
    }
    switch (deviceType) {
      case "iphone": return { width: "375px", height: "667px" };
      case "ipad":   return { width: "768px", height: "1024px" };
      case "android": return { width: "360px", height: "640px" };
      default:       return { width: "100%", height: "100%" };
    }
  };

  return {
    selectedDevice, handleSelectDevice,
    showDevicePopup, setShowDevicePopup, devicePopupRef,
    customWidth, setCustomWidth, customHeight, setCustomHeight,
    previewContainerRef, handleResizeDragStart,
    deviceType, setDeviceType, getDeviceStyles,
  };
}
