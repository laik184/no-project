/**
 * client/src/features/swarm/useSwarmEvents.ts
 *
 * React hook: subscribes to swarm SSE events and maintains live state.
 * Single responsibility: event subscription and state management.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { SwarmState, SwarmEvent, SwarmAgentStatus, SwarmPhase } from "./swarm-types";

export interface UseSwarmEventsResult {
  swarmState:  SwarmState | null;
  events:      SwarmEvent[];
  conflicts:   number;
  isConnected: boolean;
  error:       string | null;
  clearEvents: () => void;
}

const MAX_EVENTS = 200;

export function useSwarmEvents(
  runId:     string | null,
  projectId: number | null,
): UseSwarmEventsResult {
  const [swarmState,  setSwarmState]  = useState<SwarmState | null>(null);
  const [events,      setEvents]      = useState<SwarmEvent[]>([]);
  const [conflicts,   setConflicts]   = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const clearEvents = useCallback(() => setEvents([]), []);

  useEffect(() => {
    if (!runId || projectId === null) return;

    const url = `/api/sse?projectId=${projectId}&topics=agent`;
    const es   = new EventSource(url);
    esRef.current = es;

    es.onopen = () => { setIsConnected(true); setError(null); };

    es.addEventListener("agent", (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data) as {
          eventType: string;
          payload:   Record<string, unknown>;
          runId:     string;
          projectId: number;
          ts:        number;
        };

        if (raw.runId !== runId) return;

        const event: SwarmEvent = {
          type:      raw.eventType,
          swarmId:   String(raw.payload.swarmId ?? ""),
          runId:     raw.runId,
          projectId: raw.projectId,
          payload:   raw.payload,
          ts:        raw.ts,
        };

        setEvents(prev => [event, ...prev].slice(0, MAX_EVENTS));

        // Update swarm state from graph updates
        if (raw.eventType === "swarm.graph.update") {
          const graph = raw.payload.graph as import("./swarm-types").SwarmTaskNode[];
          setSwarmState(prev => prev
            ? { ...prev, taskGraph: graph }
            : {
                swarmId:   event.swarmId,
                phase:     "spawning",
                agents:    [],
                taskGraph: graph,
                startedAt: raw.ts,
              });
        }

        // Track phase changes
        if (raw.eventType === "swarm.phase.changed") {
          const phase = raw.payload.phase as SwarmPhase;
          setSwarmState(prev => prev ? { ...prev, phase } : null);
        }

        // Track agent spawned
        if (raw.eventType === "agent.spawned") {
          setSwarmState(prev => {
            if (!prev) return null;
            const agent = {
              agentId:   String(raw.payload.agentId),
              role:      raw.payload.role as import("./swarm-types").SwarmAgentRole,
              taskId:    String(raw.payload.taskId),
              status:    "spawned" as SwarmAgentStatus,
              spawnedAt: raw.ts,
            };
            const exists = prev.agents.find(a => a.agentId === agent.agentId);
            return {
              ...prev,
              agents: exists ? prev.agents : [...prev.agents, agent],
            };
          });
        }

        // Track agent status
        const statusMap: Record<string, SwarmAgentStatus> = {
          "agent.started":   "started",
          "agent.completed": "completed",
          "agent.failed":    "failed",
          "agent.blocked":   "blocked",
          "swarm.recovery":  "recovering",
        };

        if (raw.eventType in statusMap) {
          const newStatus = statusMap[raw.eventType];
          const agentId   = String(raw.payload.agentId);
          setSwarmState(prev => {
            if (!prev) return null;
            return {
              ...prev,
              agents: prev.agents.map(a =>
                a.agentId === agentId ? { ...a, status: newStatus } : a,
              ),
            };
          });
        }

        // Track conflicts
        if (raw.eventType === "swarm.conflict.detected") setConflicts(c => c + 1);

      } catch { /* ignore malformed events */ }
    });

    es.onerror = () => {
      setIsConnected(false);
      setError("SSE connection lost — reconnecting…");
    };

    return () => {
      es.close();
      esRef.current = null;
      setIsConnected(false);
    };
  }, [runId, projectId]);

  return { swarmState, events, conflicts, isConnected, error, clearEvents };
}
