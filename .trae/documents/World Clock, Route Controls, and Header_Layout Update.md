## Overview
Apply four changes across the dashboard and messaging flows:
1) Revise World Clock tile (USA + Canada)
2) Add Route Open/Closed indicators in System Status and enforce send rules
3) Move page titles and back buttons into the header, enlarge titles with icons
4) Inbox layout refinements (controls and sidebar)

## World Clock (USA + Canada)
- Remove GMT‑9 entirely.
- USA: Show 4 timezones with 6 cities + main timezone per row:
  - PST (GMT‑8) – Los Angeles (main) + 6 cities
  - MST (GMT‑7) – Denver (main) + 6 cities
  - CST (GMT‑6) – Chicago (main) + 6 cities
  - EST (GMT‑5) – New York (main) + 6 cities
- Canada: Add new tile under USA:
  - Vancouver (GMT‑8) – main + 3 cities
  - Edmonton (GMT‑7) – main + 3 cities
  - Winnipeg (GMT‑6) – main + 3 cities
  - Ontario/Toronto (GMT‑5) – main + 3 cities
- Implementation:
  - Create timezone config arrays (IANA tz: America/Los_Angeles, America/Denver, America/Chicago, America/New_York, America/Vancouver, America/Edmonton, America/Winnipeg, America/Toronto).
  - Render local time using `Intl.DateTimeFormat` with `timeZone` to avoid DST errors.
  - Keep tile sizes compact; two-column layout: USA and Canada.

## Route Controls (System Status + Enforcement)
- In System Status tile display:
  - Routes Open (green) when current time ≥ 09:00 in GMT‑8
  - Routes Closed (red) when current time ≥ 20:00 in GMT‑5
- Enforcement rules:
  - Block bulk and multi sends when Routes Closed.
  - Block single sends from Send SMS and Inbox reply when Routes Closed for normal users.
  - Admin/Supervisor override: allow single SMS only (for testing) via settings toggle.
- Implementation:
  - Client: compute both reference times using IANA tz (America/Los_Angeles, America/New_York) and show status chips.
  - Server: guard endpoints (`/api/web/sms/send-single`, `/api/web/sms/send-bulk`, `/api/web/sms/send-bulk-multi`, `/api/web/inbox/reply`) with timezone checks; honor admin/supervisor override (persist in `system_config` or per-user setting).
  - Error messaging: show toast explaining closure, with local time and next open window.

## Header + Titles + Icons
- Move the large page tile name into the app header next to the logo.
- Enlarge the page title in header to match dashboard tile size; prefix with the page’s icon.
- Ensure the blue back button sits left of the title in the header on Send SMS, Inbox, Contacts, Message History.
- Implementation:
  - Update `DashboardHeader` to render dynamic title and icon based on route (`/send-sms`, `/inbox`, `/contacts`, `/message-history`).
  - Provide back navigation target (Admin/Supervisor/Dashboard) consistently from header.

## Inbox Layout Refinements
- Move All and Unread indicators next to the search input.
- Ensure the sidebar width is consistent and not overflowing; fix wrapping/ellipsis for long lines.
- Keep date next to From number; use smaller line height for more density.

## Technical Notes
- Timezone handling: use IANA time zones with `Intl.DateTimeFormat` or `date-fns-tz` if present; avoid fixed offsets to respect DST.
- Settings storage: add `routes.override.allowSingle` (global or per role) to `system_config`; UI toggle visible to Admin/Supervisor only.
- Server checks: centralize route gating logic in a helper used by SMS endpoints.

## Rollout Steps
1) Implement World Clock config + rendering (USA + Canada) and remove GMT‑9.
2) Add System Status chips and client-side preview; implement server enforcement + override.
3) Update header to show back button + title + icon per page; remove in-page titles.
4) Move Inbox All/Unread next to search; adjust sidebar width and spacing.
5) Build and deploy; verify tiles, header, and route gating.

Confirm and I’ll implement these changes, deploy, and validate the UI and sending rules across all pages.