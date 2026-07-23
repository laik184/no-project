---
name: Mockup sandbox setup
description: Startup behavior for newly created mockup-sandbox artifacts in this workspace
---

Newly created mockup-sandbox artifacts can have their package manifest and workflow configured before dependencies exist locally. The preview workflow then fails with `vite: command not found` until dependencies are installed from the sandbox directory.

**Why:** The artifact creation flow provisioned the sandbox structure and workflow but did not populate `node_modules` in this workspace.

**How to apply:** When a fresh mockup sandbox workflow fails with `vite: command not found`, inspect for missing `node_modules`, install the sandbox's declared packages, and restart the exact managed workflow.