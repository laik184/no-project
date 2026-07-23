---
name: Upgrade mobile flow
description: Responsive navigation rule for the Upgrade and plan-selection experience.
---

On small screens, Upgrade should use focused steps: home/current plan, choose plan, plan details, essential comparison, confirmation, and success. The desktop pricing grid and existing dialog flow remain the desktop experience.

**Why:** Pricing cards, feature lists, comparison tables, and confirmation content create an oversized mobile page; a step flow keeps one decision visible at a time while preserving the complete journey.

**How to apply:** Reuse the shared plan data, billing-cycle state, local persistence, processing handler, and return path. Switch only the presentation at the mobile breakpoint and keep mobile actions at touch-friendly sizes with explicit back navigation.