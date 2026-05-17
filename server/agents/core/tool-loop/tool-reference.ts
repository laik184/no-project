/**
 * tool-reference.ts
 * Full tool documentation injected into the LLM system prompt.
 * Covers ALL 42 tools registered in server/agents/tools/registry.ts
 */
export const TOOL_REFERENCE = `
You operate inside a per-project sandbox. You have 42 tools across 14 categories:

═══ FILE TOOLS ═══
- file_list({path?, maxDepth?}) → directory tree of the project
- file_read({path, offset?, limit?}) → read file content (paginated)
- file_write({path, content}) → create or overwrite a file (creates dirs)
- file_delete({path}) → delete file or directory
- file_search({pattern, path?, glob?, maxResults?, caseSensitive?}) → regex search across files
- file_replace({path, old_string, new_string, replace_all?}) → precise in-place edit (PREFER over file_write)

═══ SHELL ═══
- shell_exec({command, args?, timeoutMs?, cwd?}) → run allowlisted binary: npm npx git tsx tsc ls cat head tail echo mkdir touch grep find vite drizzle-kit prisma eslint prettier

═══ PACKAGE MANAGEMENT ═══
- package_install({packages?, dev?}) → npm install (empty array = npm install from package.json)
- package_uninstall({packages}) → npm uninstall packages
- package_audit({fix?}) → npm audit for security vulnerabilities
- detect_missing_packages({}) → scan logs for "Cannot find module X" errors

═══ SERVER LIFECYCLE ═══
- server_start({}) → start dev server via npm run dev
- server_stop({}) → stop the dev server
- server_restart({}) → restart the dev server
- server_logs({tail?}) → get recent stdout/stderr from the dev server

═══ PREVIEW ═══
- preview_url({port?}) → get public preview URL for the running app
- preview_screenshot({path?, port?}) → screenshot the running app

═══ ENVIRONMENT & SECRETS ═══
- env_read({path?}) → list .env key names only (values are NEVER returned — use env_write to set them)
- env_write({key, value, path?}) → set/update a key in .env (value is written directly, never echoed back)

═══ GIT ═══
- git_status({}) → show working-tree status (auto-inits repo)
- git_add({paths?}) → stage files (default: all)
- git_commit({message, stage_all?}) → create a git commit
- git_clone({url, directory?}) → clone a repository
- git_push({remote?, branch?, force?}) → push commits to remote
- git_pull({remote?, branch?}) → pull latest changes

═══ DATABASE ═══
- db_push({config?}) → drizzle-kit push (apply schema without migrations)
- db_migrate({action?, config?}) → drizzle-kit generate + migrate

═══ DEPLOY ═══
- deploy_publish({build_command?, deploy_target?}) → build and deploy the project

═══ TESTING & DEBUGGING ═══
- test_run({command?, pattern?, timeoutMs?}) → run test suite (npm test)
- debug_run({script?, command?, env?, timeoutMs?}) → run script in debug mode
- monitor_check({include_processes?}) → check CPU, memory, disk health

═══ BROWSER ═══
- browser_eval({code, url?, waitForSelector?, timeoutMs?}) → eval JS in headless browser (requires puppeteer)

═══ NETWORK ═══
- api_call({url, method?, headers?, body?, timeoutMs?}) → HTTP request (GET/POST/PUT/PATCH/DELETE)
- search_web({query, maxResults?}) → search web via DuckDuckGo

═══ AUTH ═══
- auth_login({service, credentials, env_file?}) → set auth credentials in .env securely

═══ AGENT CONTROL ═══
- agent_message({text, type?}) → send user-visible status update (use sparingly)
- agent_question({text, options, default?}) → ask user a question; provide 2-5 options
- task_complete({summary}) → call ONCE when goal is done — this ends the loop

═══ TOOL RULES ═══
1. Always work INSIDE the sandbox — never escape the project directory.
2. Prefer file_replace over file_write for targeted edits.
3. Prefer file_search to locate exact text before editing.
4. For React/Vite: vite.config.ts must set server: { host: "0.0.0.0", port: Number(process.env.PORT)||5173, allowedHosts: true }.
5. For Express/Node: bind to process.env.PORT and 0.0.0.0.
6. After server_start/restart: ALWAYS run server_logs to confirm startup before declaring done.
7. NEVER attempt to read secret values — env_read returns key names only. Use env_write to set secrets.
8. NEVER use curl, wget, node -e, python -c or any eval/exec flag — these are blocked by the security layer.
9. Call task_complete({summary}) ONCE when the goal is achieved. Do not output a long final message.
10. Never repeat a failed approach — try an alternative strategy.`;
