import { useEffect, RefObject } from "react";

interface CaptureState {
  setConsoleLogs: React.Dispatch<React.SetStateAction<Array<{ type: string; message: string; time: string }>>>;
  setNetworkRequests: React.Dispatch<React.SetStateAction<Array<{ method: string; url: string; status: string; type: string; time: string }>>>;
  setDomElements: React.Dispatch<React.SetStateAction<string>>;
}

export function usePreviewCapture(
  iframeRef: RefObject<HTMLIFrameElement>,
  { setConsoleLogs, setNetworkRequests, setDomElements }: CaptureState
) {
  useEffect(() => {
    if (!iframeRef.current) return;

    const setupConsoleCapture = () => {
      try {
        const iframeWindow = iframeRef.current?.contentWindow as any;
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeWindow) return;

        const getTime = () => new Date().toLocaleTimeString();

        if (iframeWindow?.console) {
          const originalLog = iframeWindow.console.log;
          const originalError = iframeWindow.console.error;
          const originalWarn = iframeWindow.console.warn;
          const originalInfo = iframeWindow.console.info;

          const capture = (type: string) => (...args: any[]) => {
            const message = args.map(arg => typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)).join(" ");
            setConsoleLogs(prev => [...prev, { type, message, time: getTime() }]);
          };

          iframeWindow.console.log = function(...args: any[]) { originalLog?.apply(iframeWindow.console, args); capture("log")(...args); };
          iframeWindow.console.error = function(...args: any[]) { originalError?.apply(iframeWindow.console, args); capture("error")(...args); };
          iframeWindow.console.warn = function(...args: any[]) { originalWarn?.apply(iframeWindow.console, args); capture("warn")(...args); };
          iframeWindow.console.info = function(...args: any[]) { originalInfo?.apply(iframeWindow.console, args); capture("info")(...args); };
        }

        if (iframeDoc) {
          const observer = new MutationObserver(() => {
            const htmlStr = iframeDoc.documentElement.outerHTML.substring(0, 2500);
            setDomElements(htmlStr);
          });
          observer.observe(iframeDoc.documentElement, { childList: true, subtree: true, attributes: true, attributeOldValue: true });
          return () => observer.disconnect();
        }
      } catch (e) {
        console.error("Failed to setup console capture:", e);
      }
    };

    setupConsoleCapture();
    const el = iframeRef.current;
    el.addEventListener("load", setupConsoleCapture);
    return () => el.removeEventListener("load", setupConsoleCapture);
  }, []);

  useEffect(() => {
    if (!iframeRef.current) return;

    const setupNetworkCapture = () => {
      try {
        const iframeWindow = iframeRef.current?.contentWindow as any;
        if (!iframeWindow) return;
        const getTime = () => new Date().toLocaleTimeString();

        if (iframeWindow?.fetch) {
          const originalFetch = iframeWindow.fetch;
          iframeWindow.fetch = async function(url: any, options?: any) {
            const method = (options?.method || "GET").toUpperCase();
            const urlStr = typeof url === "string" ? url : url.toString();
            const time = getTime();
            try {
              const response = await originalFetch(url, options);
              setNetworkRequests(prev => [...prev, { method, url: urlStr.split("?")[0], status: response.status.toString(), type: response.headers.get("content-type") || "application/octet-stream", time }]);
              return response;
            } catch (e) {
              setNetworkRequests(prev => [...prev, { method, url: urlStr, status: "error", type: "failed", time }]);
              throw e;
            }
          };
        }

        if (iframeWindow?.XMLHttpRequest) {
          const OriginalXHR = iframeWindow.XMLHttpRequest;
          iframeWindow.XMLHttpRequest = function() {
            const xhr = new OriginalXHR();
            const originalOpen = xhr.open;
            const originalSend = xhr.send;
            let method = "", url = "";
            const time = getTime();
            xhr.open = function(meth: string, u: string, ...args: any) { method = meth; url = u; return originalOpen.apply(xhr, [meth, u, ...args]); };
            xhr.send = function(...args: any) {
              const onReadyStateChange = xhr.onreadystatechange;
              xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                  setNetworkRequests(prev => [...prev, { method, url: url.split("?")[0], status: xhr.status.toString(), type: xhr.getResponseHeader("content-type") || "application/octet-stream", time }]);
                }
                onReadyStateChange?.apply(xhr, arguments);
              };
              return originalSend.apply(xhr, args);
            };
            return xhr;
          };
        }
      } catch (e) {
        console.error("Failed to setup network capture:", e);
      }
    };

    setupNetworkCapture();
    const el = iframeRef.current;
    el.addEventListener("load", setupNetworkCapture);
    return () => el.removeEventListener("load", setupNetworkCapture);
  }, []);
}
