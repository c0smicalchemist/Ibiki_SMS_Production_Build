## Benefits
- Smaller initial download: only load code for the current screen (reduces main JS by 30–50%).
- Faster parse/execute: the browser parses less JS at startup; time‑to‑interactive improves.
- Lower memory footprint: unused modules aren’t kept in memory until needed.
- Smoother UI: large lists render only visible rows (60fps), avoiding long paint/reflow cycles.
- Resiliency: slows payloads aren’t a blocker; chunked code loads when a user navigates.
- Works with no-store: avoids relying on caches by reducing work and bytes, not by reusing stale responses.

## Scope
- Pages: AdminDashboard, Inbox, MessageActivityViewer.
- Lists: Inbox threads, message logs (admin/supervisor), contacts.

## Technical Plan
### Code‑Splitting (Vite + React)
1. Convert heavy page modules to lazy imports: `const AdminDashboard = lazy(() => import('...'))` and wrap in `Suspense` with lightweight skeletons.
2. Split large sub‑sections inside AdminDashboard: Phraser settings, Diagnostics, User Summary load on tab selection.
3. Preload chunks on hover/focus using `link rel="preload"` or programmatic `import()` when a tab comes into view.

### List Virtualization
1. Introduce `@tanstack/react-virtual` (small dependency) for windowed rendering.
2. Wrap Inbox and Message Activity lists with virtualizer; render ~20 rows at a time; keep sticky headers.
3. Preserve empty/skeleton rows for smooth scrolling while data fetches.

### API & Data Layer Synergy
1. Use new `cursor` param for message logs (already added) and page with `nextCursor`.
2. Keep React Query `staleTime` short to de‑dupe in‑memory requests per view without persisting.

### Build & Transport
1. Confirm chunk naming and manifest; add prefetch hints for likely next views.
2. Keep production source maps off to reduce payload; verify bundle size regression budget.

### Validation
- Measure before/after:
  - Initial bundle size, parse+execute time, TTI.
  - Inbox and MessageActivity FPS with 1k+ items.
  - Server timing headers (`Server-Timing: db`) + UI timings (`performance.mark`).
- Rollback guard: feature flags to disable virtualization per page.

## Deliverables
- Lazy‑loaded AdminDashboard tabs and page modules.
- Virtualized Inbox and Message Activity lists.
- Preload on hover for tabbed sections.
- Docs in README with usage and feature flag.

Confirm and I’ll implement, test, and ship with measurable improvements.