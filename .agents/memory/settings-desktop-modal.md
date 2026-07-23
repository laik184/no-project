---
name: Settings desktop modal
description: Desktop Settings modal sizing and sidebar-to-content interaction rule.
---

On desktop, Settings is a compact centered modal. The left category rail controls which single section is rendered in the right panel; changing categories replaces the panel content instead of scrolling through all sections.

**Why:** The reference interaction keeps navigation and content visible together, making section changes immediate and avoiding a long settings page inside a small modal.

**How to apply:** Keep the selected section in shared state, mark the active sidebar item, render only that section on desktop, and let only the right content panel scroll when its form is taller than the modal.