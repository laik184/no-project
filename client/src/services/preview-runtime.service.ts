export const PreviewRuntimeService = {
  async runProject(id: string, projectPath: string) {
    void projectPath;
    const res = await fetch(`/api/runtime/${Number(id)}/start`, { method: "POST" });
    if (!res.ok) throw new Error("Run failed");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? "Run failed");
    return true;
  },

  async stopProject(id: string) {
    const res = await fetch(`/api/runtime/${Number(id)}/stop`, { method: "POST" });
    if (!res.ok) throw new Error("Stop failed");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? "Stop failed");
    return true;
  },

  async getStatus() {
    const res = await fetch("/api/project-status");
    return res.json();
  },

  async getTunnelInfo() {
    const res = await fetch("/api/tunnel-info");
    return res.json();
  },

  async restartProject(id: string, projectPath: string) {
    void projectPath;
    const res = await fetch(`/api/runtime/${Number(id)}/restart`, { method: "POST" });
    if (!res.ok) throw new Error("Restart failed");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? "Restart failed");
  }
};
