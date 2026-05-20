/**
 * consensus-engine.ts
 *
 * Multi-agent voting system for high-stakes decisions.
 * Requires a quorum of agent roles to agree before proceeding.
 */

import { randomUUID } from "crypto";
import type {
  ConsensusProposal, ConsensusVote, ConsensusResult, AgentRole,
} from "./supervisor-types.ts";

// ── In-memory proposal store ──────────────────────────────────────────────────

const _proposals = new Map<string, ConsensusProposal>();
const _votes     = new Map<string, ConsensusVote[]>();

export function createProposal(
  description:   string,
  proposer:      AgentRole,
  payload:       unknown,
  requiredRoles: AgentRole[],
  threshold:     number = 0.6,
): ConsensusProposal {
  const proposal: ConsensusProposal = {
    id:            randomUUID(),
    description,
    proposer,
    payload,
    requiredRoles,
    threshold,
  };
  _proposals.set(proposal.id, proposal);
  _votes.set(proposal.id, []);
  return proposal;
}

export function castVote(vote: ConsensusVote): void {
  const votes = _votes.get(vote.proposalId);
  if (!votes) throw new Error(`[consensus] Unknown proposal: ${vote.proposalId}`);

  // Each role can only vote once
  const existing = votes.findIndex(v => v.agentRole === vote.agentRole);
  if (existing >= 0) {
    votes[existing] = vote;
  } else {
    votes.push(vote);
  }
}

export function resolveConsensus(proposalId: string): ConsensusResult {
  const proposal = _proposals.get(proposalId);
  const votes    = _votes.get(proposalId) ?? [];

  if (!proposal) {
    return { proposalId, reached: false, agreementRate: 0, votes: [], conflicts: ["Unknown proposal"] };
  }

  const required  = proposal.requiredRoles;
  const voted     = votes.filter(v => required.includes(v.agentRole));
  const agreed    = voted.filter(v => v.agree);
  const disagreed = voted.filter(v => !v.agree);

  const agreementRate = voted.length === 0 ? 0 : agreed.length / voted.length;
  const reached       = agreementRate >= proposal.threshold &&
                        voted.length  >= Math.ceil(required.length * 0.5);

  const conflicts: string[] = disagreed.map(v =>
    `${v.agentRole}: ${v.reason.slice(0, 80)}`,
  );

  return { proposalId, reached, agreementRate, votes: voted, conflicts };
}

/** Wait for consensus with a timeout. Polls every 500ms. */
export async function awaitConsensus(
  proposalId: string,
  timeoutMs:  number = 30_000,
): Promise<ConsensusResult> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = resolveConsensus(proposalId);
    if (result.reached || result.conflicts.length > 0) {
      const proposal = _proposals.get(proposalId)!;
      const required = proposal.requiredRoles.length;
      const voted    = result.votes.length;

      // Force resolve if all required roles have voted
      if (voted >= required) return result;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Timeout — resolve with partial votes
  return resolveConsensus(proposalId);
}

export function clearProposal(proposalId: string): void {
  _proposals.delete(proposalId);
  _votes.delete(proposalId);
}

/** Auto-cast a single-agent approval (when multi-agent voting not needed). */
export function autoApprove(
  description: string,
  proposer:    AgentRole,
  payload:     unknown,
): ConsensusResult {
  const proposal = createProposal(description, proposer, payload, [proposer], 1.0);
  castVote({
    agentRole:  proposer,
    proposalId: proposal.id,
    agree:      true,
    reason:     "Auto-approved by proposer",
    confidence: 1.0,
  });
  return resolveConsensus(proposal.id);
}
