import { useEffect, useState } from "react";

export interface Artifact {
  id: string;
  name: string;
  type: string;
  url: string;
  createdAt: string;
}

export function useArtifacts() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchArtifacts() {
      try {
        const res = await fetch("/api/artifacts");
        if (!res.ok) throw new Error("Failed to load artifacts");
        const data = await res.json();
        if (active) setArtifacts(data.artifacts || data || []);
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchArtifacts();
    const t = setInterval(fetchArtifacts, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return { artifacts, loading, error };
}