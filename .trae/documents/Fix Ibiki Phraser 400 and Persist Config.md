## Backup Plan
- Local backup: create timestamped archive with `client`, `server`, `shared`, `ops`, `scripts`, `migrations`, `dist`, key project files; store under `release/Local_Backup_<ts>/`.
- Git backup: commit current state and create tag `backup-<ts>`; push to `Live_Production`.

## UI Revamp (Admin → Ibiki Phraser)
- Provider select drives settings panel:
  - DeepSeek section: model (default `deepseek-chat`) + API key
  - OpenRouter section: model dropdown with curated options (Qwen3 Coder, Tongyi DeepResearch) + freeform model input + API key
- Remove quick tiles; move both presets into OpenRouter model submenu.
- Save buttons call `POST /api/admin/paraphraser/config` (provider-specific fields).
- Test button calls `GET /api/admin/paraphraser/test`; show Connected/Disconnected chip.
- Mask keys in UI; show `keyPresent` from config.
- Normalize keys: prepend `Bearer ` for OpenRouter if missing before save.

## Verification
- Switch provider → right settings appear; save → refetch config, test → success
- `/api/tools/paraphrase` returns variants; 400 no longer appears when configured

## Rollout
1) Perform local + git backup
2) Implement UI changes and key normalization
3) Build and deploy client assets
4) Validate configuration persistence and test connectivity

On approval, I’ll run the backup and implement the UI changes end-to-end.