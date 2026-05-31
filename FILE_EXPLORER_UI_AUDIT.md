# File Explorer UI Audit

**Component:** `client/src/components/file-explorer/FileExplorer.tsx`
**Date:** 2026-05-31

---

## Measurements

| Property | Current Value | Recommended Value | Reason |
|---|---|---|---|
| Sidebar width | `240px` | `220px` | Typical IDE sidebars are 180–220px; 240 wastes horizontal space |
| Header height | `36px` | `32px` | VS Code / Cursor use 28–32px headers |
| Header padding | `0 6px 0 10px` | `0 4px 0 8px` | Slightly tighter on both sides |
| Search container padding | `5px 8px` | `4px 6px` | Reduces bloat above/below search row |
| Search input padding | `3px 8px` | `2px 6px` | Inner search box slightly tall |
| Tree row height | `22px` | `20px` | VS Code uses 20px, Replit uses 20px |
| Tree row paddingLeft base | `4px` | `4px` | Already correct |
| Tree row paddingRight | `4px` | `4px` | Already correct |
| Tree container padding | `2px 0` | `2px 0` | Fine |
| INDENT per level | `16px` | `14px` | Slightly tighter indent guide |
| Header button size | `22×22px` | `20×20px` | Matches row height, more proportional |
| Header button border-radius | `4px` | `3px` | Slight sharpness fits IDE feel |
| Header icon size | `13×13px` | `12×12px` | Proportional to smaller button |
| InlineCreateRow height | `26px` | `22px` | Should match tree row proportions |
| InlineCreateRow padding | `3px 8px 3px 10px` | `2px 6px 2px 8px` | Align with search box tightening |
| InlineCreateRow icon | `12×12px` | `11×11px` | Match rest of icon scale |
| Empty state top padding | `28px` | `20px` | Too generous; IDE empty states are compact |
| Empty state gap | `10px` | `8px` | Slightly tighter |
| Empty state icon box | `36×36px` | `28×28px` | Oversized for a sidebar icon |
| Empty state icon box radius | `8px` | `6px` | Proportional |
| Empty state icon size | `16×16px` | `13×13px` | Scale with box |
| Empty state bottom padding | `20px` | `14px` | Trim excess bottom space |
| Empty state button padding | `5px 10px` | `4px 8px` | Slightly tighter |
| Empty state button radius | `5px` | `4px` | Consistent with header buttons |
| Empty state button gap | `6px` | `4px` | Tighter gap between icon and label |
| Empty state button margin-top | `2px` | `0px` | Gap property already provides spacing |
| Empty state overall padding | `28px 16px 20px` | `20px 12px 14px` | ~20% reduction overall |

---

## Summary

- **7 height/size values** reduced
- **8 padding/margin values** reduced  
- **No logic, API, or hook changes**
- **No text size changes** (12px / 11px body text preserved)
- **Scrollbar, indent guides, chevrons** all preserved
