import { useState, useEffect, type RefObject } from "react";
import type { ElementInfo } from "@/pages/preview/DevToolsPanel";

export function useInspectLogic(iframeRef: RefObject<HTMLIFrameElement>) {
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedElementInfo, setSelectedElementInfo] = useState<ElementInfo | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "inspect-element-select") {
        const d = e.data.payload as ElementInfo;
        setSelectedElementInfo(d);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const SCRIPT_ID = "__replit_inspect__";
    const inject = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        if (doc.getElementById(SCRIPT_ID)) return;
        const script = doc.createElement("script");
        script.id = SCRIPT_ID;
        script.textContent = `
(function() {
  var _hovered = null;
  var _prevOutline = null;
  var _prevOutlineOffset = null;
  function getStyles(el) {
    var cs = window.getComputedStyle(el);
    var keys = ["display","position","width","height","padding","margin","border","background","color","font-size","font-family","flex","grid","overflow","z-index","opacity","border-radius","box-shadow","line-height"];
    var result = {};
    keys.forEach(function(k){ result[k] = cs.getPropertyValue(k); });
    return result;
  }
  function getAttrs(el) {
    var out = {};
    for(var i = 0; i < el.attributes.length; i++){
      out[el.attributes[i].name] = el.attributes[i].value;
    }
    return out;
  }
  function onMouseOver(e) {
    if(_hovered && _hovered !== e.target) {
      _hovered.style.outline = _prevOutline;
      _hovered.style.outlineOffset = _prevOutlineOffset;
    }
    _hovered = e.target;
    _prevOutline = _hovered.style.outline;
    _prevOutlineOffset = _hovered.style.outlineOffset;
    _hovered.style.outline = '2px solid #6c8ef5';
    _hovered.style.outlineOffset = '1px';
    e.stopPropagation();
  }
  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    var rect = el.getBoundingClientRect();
    var data = {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: Array.from(el.classList),
      rect: { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left) },
      styles: getStyles(el),
      attributes: getAttrs(el)
    };
    window.parent.postMessage({ type: 'inspect-element-select', payload: data }, '*');
  }
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);
  window.__removeInspect__ = function() {
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
    if(_hovered) { _hovered.style.outline = _prevOutline; _hovered.style.outlineOffset = _prevOutlineOffset; }
  };
})();`;
        doc.head.appendChild(script);
      } catch (_) {}
    };
    const remove = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const s = doc.getElementById(SCRIPT_ID);
        if (s) s.remove();
        const w = iframe.contentWindow as any;
        if (w?.__removeInspect__) w.__removeInspect__();
      } catch (_) {}
    };
    if (inspectMode) { inject(); } else { remove(); setSelectedElementInfo(null); }
  }, [inspectMode]);

  return { inspectMode, setInspectMode, selectedElementInfo, setSelectedElementInfo };
}
