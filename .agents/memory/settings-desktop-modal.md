---
name: Settings desktop modal
description: Desktop Settings modal sizing and sidebar-to-content interaction rule.
---

On desktop, Settings is a compact centered modal. The modal is the only main container: its header and divider sit above a body whose direct children are the flat sidebar navigation and flat content panel. The left category rail controls which single section is rendered in the right panel; changing categories replaces the panel content instead of scrolling through all sections. Sidebar and content scroll independently.

**Why:** The reference interaction keeps navigation and content visible together, making section changes immediate and avoiding nested cards or a long settings page inside a small modal.

**How to apply:** Keep the selected section in shared state, mark the active sidebar item, render only that section on desktop, keep the modal viewport-safe without a fixed content height, lock page scrolling while open, and let only the sidebar/content columns scroll when needed.