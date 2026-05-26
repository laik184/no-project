export function toolDocAnchor(tool: string): string {
  return tool.replace(/[._]/g, "-");
}

export async function fetchFileContent(filePath: string): Promise<{ content: string; lang: string }> {
  try {
    const res = await fetch("/api/inventory/actions/open-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { content: String(data.content ?? ""), lang: String(data.lang ?? "plaintext") };
    }
    const errMsg = data?.error || `HTTP ${res.status}`;
    return { content: `// Could not load ${filePath}\n// ${errMsg}`, lang: "plaintext" };
  } catch (e: any) {
    return { content: `// Error loading ${filePath}\n// ${e?.message ?? e}`, lang: "plaintext" };
  }
}

export async function invokeToolBackend(name: string, args: Record<string, unknown> = {}) {
  try {
    const res = await fetch(`/api/inventory/tools/${encodeURIComponent(name)}/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args }),
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export function guessLangFromPath(p: string): string {
  const ext = (p.split(".").pop() ?? "").toLowerCase();
  return ({
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", css: "css", html: "html",
    py: "python", go: "go", rs: "rust",
  } as Record<string, string>)[ext] ?? "plaintext";
}

export async function fetchChatHistory(projectId: number) {
  const res = await fetch(`/api/chat/history?projectId=${projectId}`);
  if (!res.ok) return [];
  const j = await res.json();
  return (j.history ?? []) as { id: string; title: string; time: string; status: string; active: boolean }[];
}

export async function fetchChatPrompts(projectId: number) {
  const res = await fetch(`/api/chat/prompts?projectId=${projectId}`);
  if (!res.ok) return null;
  const j = await res.json();
  return (j.prompts ?? null) as string[] | null;
}
