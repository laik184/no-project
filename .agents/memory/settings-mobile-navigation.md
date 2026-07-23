---
name: Settings mobile navigation
description: Responsive navigation rule for the Settings experience.
---

On small screens, Settings should open to a category home and render only one section after selection. Each section needs a touch-friendly sticky header with back navigation and save state; the desktop sidebar and full-section layout remain the desktop experience.

**Why:** The settings form contains many controls and becomes an excessive scroll on phones; category navigation preserves every feature without compressing the desktop information architecture.

**How to apply:** Keep shared form/state logic in the Settings page, switch only the presentation at the mobile breakpoint, and preserve the section IDs/content so resizing or future deep links do not create duplicate settings implementations.