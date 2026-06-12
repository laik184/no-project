# NURAX Project Intelligence Documentation

This documentation set was generated from a deep codebase scan of the current repository implementation.

## Documents

1. [Product Overview](./01-product-overview.md)
2. [User Flows](./02-user-flows.md)
3. [Feature Specification](./03-feature-specification.md)
4. [System Architecture](./04-system-architecture.md)
5. [Module Responsibilities](./05-module-responsibilities.md)
6. [Dependency Rules](./06-dependency-rules.md)
7. [API Contracts](./07-api-contracts.md)
8. [Data Model](./08-data-model.md)
9. [Runtime Lifecycle](./09-runtime-lifecycle.md)
10. [Error Recovery](./10-error-recovery.md)
11. [Testing Strategy](./11-testing-strategy.md)
12. [Production Readiness Report](./12-production-readiness-report.md)

## Evidence labels

Each document separates implementation facts from inferred behavior and assumptions:

- **FACT**: verified from source/config/tests.
- **INFERRED**: derived from connected facts where code does not explicitly state intent.
- **ASSUMPTION**: plausible intended behavior that is not fully proven or implemented.

## High-level conclusion

NURAX is an agentic application builder/workspace with chat-driven runs, orchestration, tools, sandbox file operations, terminal execution, preview runtime, checkpoints, and memory. The implemented architecture is broad and promising, but current production readiness is limited by unmounted UI APIs, in-memory critical state, incomplete recovery, incomplete default test coverage, and production bundle warnings.
