## Backup & Git
- Create a local archive from the current working tree and tag the commit for traceability
  - Commands: `git add -A`, `git commit -m "Dashboard gating + UI updates"`, `git tag -a vYYYYMMDD-ibiki -m "Release tag"`, `git archive -o ..\\Ibiki_SMS_Backup-vYYYYMMDD-ibiki.zip HEAD`
  - Push to remote: `git push origin HEAD`, `git push origin --tags`
- Verify the backup file exists and includes all updated assets

## Extreme Blacklist Tagging
- Server
  - Confirm webhook handlers persist provider `status` and `matchedBlockWord` in `incoming_messages` rows
  - Ensure `extPayload`/raw fields are stored for audit; add migration if missing
- Client
  - Inbox list: show a small destructive badge "Blacklisted" on rows when `status` matches `/blacklist|blocked/i` or `matchedBlockWord` is present
  - Conversation view already shows a badge; keep consistent styling
- Endpoints
  - No changes required to fetch API if fields already returned; if not, include `status` and `matchedBlockWord` in `GET /api/web/inbox` result
- Validation
  - Post a webhook payload with `status: blocked` and verify the badge appears in Inbox list and conversation

## CSV Export: Reply Percentage
- Server option (preferred for CSV): extend `GET /api/group/message-status-today.csv` to add `reply_rate` column computed as `(received_today / sent_today * 100).toFixed(2)` with `0.00` when `sent_today == 0`
- Client table (optional): display a computed reply rate column next to counts
- Update `exportGroupCsv` to accept the new column without breaking existing flows
- Validation
  - Run export for a known date and verify `reply_rate` values are correct (e.g., 25 replies / 1000 sent = 2.50%)

## Routes Closed Disclaimer Dialog (Bilingual)
- UI: in Admin System Status StatCard, add a red `HelpCircle` icon next to "Routes Closed (8:00PM GMT-5)"
- Dialog: clicking opens a modal explaining the logic
  - English: "When routes are closed, you cannot send SMS to new clients. If a client has replied into your inbox, you may respond to that conversation."
  - Chinese: provide equivalent translation; render based on language toggle
- i18n: add keys under `admin.systemStatus.help.*` in `client/src/lib/i18n.ts`
- Validation
  - Toggle language to Chinese and verify dialog content switches

## Reply Policy Confirmation (Closed Hours)
- Confirm current policy:
  - Bulk/bulk-multi: blocked when closed (no override)
  - Single: requires Admin/Supervisor override when closed
  - Reply: allowed when the conversation has any inbound messages (no time restriction)
- Add/adjust unit tests or manual checks for each path

## Supervisor Override Tab
- Add an "Override" tab next to "Group Report" in supervisor view; reuse existing route-override state/mutation
- Verify toggle updates config (`POST /api/admin/routes-override`) and gating reflects immediately

## Rollout & Verification
- Build client and server
- Deploy using existing scripts, reload Nginx & restart PM2
- Checks:
  - `GET /api/system/gating` reflects open/closed state
  - Webhook POST test (blocked/blacklist) persists tags and shows badges
  - CSV export includes `reply_rate`
  - System Status dialog shows in both languages

Please confirm this plan. Once approved, I will implement the changes, run a backup and git push, and then perform the full validation steps described above.