/**
 * server/tools/contracts/tool.ts
 *
 * Core Tool contract for the Clean Architecture tool layer.
 *
 * Dependency rule:
 *   Agent → Tool → Service → Repository → Persistence → Infrastructure
 *
 * Tools MUST NOT import: Repository, Persistence, Infrastructure,
 *                        Database, Redis, Drizzle, Prisma.
 * Tools MAY import: Services, Tool contracts, Shared types.
 */

export interface Tool<TInput, TOutput> {
  readonly id:          string;
  readonly description: string;
  execute(input: TInput): Promise<TOutput>;
}

export interface ToolResult<T = unknown> {
  ok:     boolean;
  data?:  T;
  error?: string;
}

export type AnyTool = Tool<unknown, unknown>;
