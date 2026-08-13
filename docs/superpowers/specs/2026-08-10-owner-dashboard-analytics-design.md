# Owner Dashboard / Analytics — Design

## Context

The `(internal)` sidebar links to `/dashboard` under "Owner Dashboard" (`src/app/(internal)/layout.tsx`), but no page exists there — it 404s. This spec covers building that page as a mock-UI dashboard (PRD section D: Peak Hour Analytics, Customer Retention & Churned Report, Global & Branch Financial Analytics), consistent with the other internal pages (`queue`, `pos`, `shift`, `attendance`), which are static/mock today pending the live Supabase project (blocked, deferred by the user).

## Goals

- Fill the dead `/dashboard` link with a real page.
- Cover three PRD-required analytics areas: peak hours, revenue/branch financials, retention/churn.
- Support viewing "All Branches" (aggregate) or a single branch, via a switcher — Owner manages multiple branches per PRD.
- Match the existing visual language (dark glass-panel theme, amber primary, lucide-react icons) and code style (functional components, Tailwind, no new state libraries).

## Non-goals (v1)

- Pending Approvals widget (kasir/kasbon authorization) — explicitly deferred by the user.
- Live data — all data is static mock, structured so it's easy to swap for real Supabase queries once the schema (already drafted in `supabase_schema.sql`) is applied.
- Tabbed/multi-route dashboard navigation — single scrolling page, matching the pattern of other internal pages.

## Approach

Single client component page (`'use client'`, needed for the branch-switcher state), custom lightweight SVG/CSS charts instead of adding a charting dependency — the project currently has zero chart libraries (only `lucide-react` + `@supabase/ssr`), and the data is mock, so a dependency isn't justified yet. If/when this page moves to live data with heavier interactivity needs (zoom, tooltips), a charting library can be reconsidered then.

## Structure

`src/app/(internal)/dashboard/page.tsx`

1. **Header + Branch Switcher** — pill/segmented control: "Semua Cabang", Senopati, Kemang, Tebet (same three branches as `/branches`). Local `useState<string>` for `selectedBranchId` (default `'all'`).
2. **KPI row** — 4 stat cards: Omzet Hari Ini, Jumlah Transaksi, Rata-rata Ticket, Pelanggan Aktif. Each shows a value + a small up/down delta vs. yesterday.
3. **Peak Hour Analytics** — heatmap grid, 7 days × operating hours (e.g. 09:00–21:00), cell shade intensity = busyness. Built as a CSS grid of divs with inline background-opacity derived from a 0–100 mock value, not an SVG chart library.
4. **Revenue Trend + Branch Breakdown** — custom SVG bar or line chart of the last 14 days' revenue; a small comparison table (branch name, omzet, estimasi laba) shown only in "Semua Cabang" view (hidden when a single branch is selected, since it'd just repeat the KPI row).
5. **Retention & Churned Report** — large repeat-rate percentage + a short list of churned customers (name, last visit date, days since).

## Data shape

One mock module-level object keyed by branch id (`'all' | 'senopati' | 'kemang' | 'tebet'`), each containing `kpis`, `peakHours` (2D array), `revenueTrend` (array of `{date, revenue}`), `branchBreakdown` (array, only meaningful under `'all'`), and `retention` (`{repeatRate, churned: [...]}`). Shape is designed to map 1:1 onto future Supabase query results (transactions, bookings, profiles) so swapping to live data later is a data-fetching change, not a component rewrite.

## Testing

Manual smoke test in the browser preview: page loads under `/dashboard`, branch switcher changes all sections' data, no console errors, responsive at mobile width (sidebar-based internal layout already handles this).
