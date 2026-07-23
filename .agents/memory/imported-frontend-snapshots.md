---
name: Imported frontend snapshots
description: Durable handling guidance for repositories imported without their original backend or frontend toolchain files.
---

When an imported repository contains a usable frontend but omits its original server and build configuration, restore only the minimum frontend runner needed for preview and keep missing API behavior explicit in the UI.

**Why:** Fabricating API responses hides the import problem and can make a debugged preview look healthy when the product cannot actually load its data.

**How to apply:** Add the smallest Vite/CSS/type aliases needed to render the existing client, use real API calls, and show loading, empty, and retryable error states for unavailable services.