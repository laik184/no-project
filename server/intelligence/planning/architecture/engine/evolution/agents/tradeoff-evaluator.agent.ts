import type { TradeoffEvaluation } from "../types.js";

export function evaluateTradeoffs(targetPattern: string): TradeoffEvaluation {
  const tradeoffs: string[] = [
    "+ Improved scalability under growth and uneven workload distribution.",
    "+ Better maintainability through stronger bounded contexts.",
    "- Increased operational complexity (monitoring, release orchestration, ownership boundaries).",
  ];

  if (targetPattern === "microservices") {
    tradeoffs.push("- Added distributed systems overhead: latency, retries, eventual consistency handling.");
  } else {
    tradeoffs.push("+ Lower migration risk than a direct leap to distributed microservices.");
  }

  return Object.freeze({ tradeoffs: Object.freeze(tradeoffs) });
}
