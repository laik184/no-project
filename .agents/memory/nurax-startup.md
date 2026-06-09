---
name: NURAX startup requirements
description: What NURAX needs to start cleanly on Replit.
---

## Required
- DATABASE_URL: Replit built-in PostgreSQL (auto-set by Replit DB)
- Schema must be pushed before first start: `npm run db:push`
- OPENROUTER_API_KEY: secret for AI agents (app starts without it but AI is disabled)

## Optional (graceful null fallbacks exist)
- REDIS_URL: enables BullMQ queue + caching (NullQueue/NullRedis used otherwise)
- LLM_MODEL: defaults to openai/gpt-oss-120b:free
- LLM_BASE_URL: defaults to https://openrouter.ai/api/v1

## Ports
- Frontend (Vite): 5000
- Backend (Express): 3001
- Vite proxies /api, /sse, /events, /preview, /ws → :3001
