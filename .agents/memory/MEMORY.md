# Agent Memory Index

- [File write system](file-write-system.md) — writes go to /home/runner/workspace/.sandbox; sandbox path fixed from /tmp (ephemeral) to persistent workspace path; real fs.writeFileSync, no mocks.
- [NURAX startup](nurax-startup.md) — requires DATABASE_URL (Replit DB) + OPENROUTER_API_KEY (secret) for AI; Redis/BullMQ optional (null fallbacks); db:push must run before first start.
- [Process group kill pattern](process-group-kill.md) — shell:true orphans node children on SIGTERM; fix: detached:true + process.kill(-pid, signal) kills entire group; mark prevEntry.status='stopping' before kill to suppress spurious process.crashed events.
