---
name: Settings component boundaries
description: Architecture rule for the settings modal after section extraction.
---

The settings modal keeps persistence, validation, navigation, toast state, and dialogs in the parent; section components own only their section UI and receive typed state/update callbacks. Shared settings types and primitives stay separate from both.

**Why:** This preserves the existing behavior while making the large settings screen maintainable and prevents section UI from duplicating modal-level orchestration.

**How to apply:** Add new settings categories as focused section components and connect them through the parent callback boundary rather than moving local-storage or dialog logic into the section.