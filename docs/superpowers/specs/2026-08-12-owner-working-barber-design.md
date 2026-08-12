# Owner-as-Kapster (Dual-Role Working Barber) — Design

## Context

`profiles.role` is a single enum (`superadmin`, `owner`, `cashier`, `barber`, `customer`) and gates both page access (`src/proxy.ts`) and every "is this person a kapster" check across the app. In practice a small barbershop owner often also cuts hair themselves — confirmed live: after transferring BARSCO's ownership to Studio Kalcer (`profiles.role = 'owner'`), they immediately lost every kapster-facing capability, because six separate places filter strictly on `role = 'barber'`:

1. `public.public_barber_status` view (`supabase_schema.sql`) — powers "Live Kapster Status" and the barber picker on the public booking page.
2. `src/app/(internal)/queue/page.tsx:81` — walk-in barber-assignment dropdown in Queue Management.
3. `src/app/(internal)/attendance/page.tsx:57` — gates whether the Free/Busy/Break clock-in toggle even renders.
4. `src/app/(internal)/layout.tsx:27` (`isBarber`) — gates the "Kapster Dashboard" sidebar section.
5. `src/app/(internal)/staff/staff-table.tsx:196` (`isBarber`) — gates the Gaji Bulanan (monthly salary) input in Staff Management.
6. `src/app/(internal)/payroll/payroll-client.tsx:135` — the barber picker owners use to run commission/payroll calculations.

Confirmed NOT role-dependent (no change needed): `src/lib/commission-calc.ts`, `src/app/(internal)/my-report/`, `src/app/(internal)/my-payroll/` (all keyed by `barber_id`/`userId` directly), and the Dashboard's "Kinerja Kapster" table (`src/app/(internal)/dashboard/data.ts`, keyed by `bookings.barber_id`). No DB constraint ties `bookings.barber_id` to `role = 'barber'`.

## Goals

- A staff member with any `role` (starting with `owner`) can be marked as an active working kapster: bookable by customers, shows in Live Kapster Status, assignable in Queue walk-ins, gets the attendance clock-in/status toggle, and earns commission/salary through the existing payroll pipeline.
- Toggle is per-profile and independent of `role` — an owner keeps full owner-page access while also functioning as a kapster.
- No changes to RLS-gated page access (`proxy.ts`), no changes to the commission calculation engine itself.

## Non-goals (v1)

- No multi-value `role` column / RBAC rewrite (Approach B considered, rejected — high risk on a live system for a narrower need).
- No change to who can access owner-only pages — this only affects kapster-facing *capabilities*, not permissions.
- Not scoped to a specific tenant/branch — any staff profile, any tenant, can have the flag.

## Approach

Add a single boolean column, `profiles.is_working_barber`, decoupled from `role`. Every one of the six call sites above changes from `role = 'barber'` to `(role = 'barber' OR is_working_barber = true)`. This is the smallest change that fully satisfies the goal: it reuses the entire existing kapster pipeline (attendance, booking, commission calc) as-is, since none of that pipeline actually depends on `role` — only the six filters do.

Rejected alternatives:
- **Multi-value `role`** — correct long-term generalization, but requires rewriting every `role = 'x'` check in RLS policies and app code on a live production system. Overkill for "owner also cuts hair."
- **Drop the `role = 'barber'` filter entirely, rely on attendance + branch_id alone** — too broad; would make any clocked-in staff (e.g. a cashier) appear as a bookable kapster.

## Schema

```sql
ALTER TABLE public.profiles
  ADD COLUMN is_working_barber BOOLEAN NOT NULL DEFAULT false;
```

`admin_set_staff_role(target_id, new_role, new_branch_id)` RPC gets a fourth parameter, `set_working_barber BOOLEAN`, written in the same statement as the role/branch update — Staff Management already saves role + branch + salary together in one "Simpan" click per row, so the flag rides along rather than needing its own round trip. Existing tenant-match guard on the RPC (added earlier this session to close the cross-tenant privilege gap) applies unchanged.

`public.public_barber_status` view's `WHERE` clause changes from `p.role = 'barber'` to `(p.role = 'barber' OR p.is_working_barber = true)`. Everything else in the view (the `attendances`/`clocked_in` join, the `confirmed`-booking override to `'busy'`) is unaffected.

## Frontend changes

- **`src/app/(internal)/staff/staff-table.tsx`**: new "Kapster Aktif" checkbox per row, available for any role (not just when `draft.role === 'barber'`). Checking it also reveals the Gaji Bulanan input (same visibility rule the Barber role already gets), since salary-type commission needs it. `isDirtyFor`/`handleSave` extended to track and persist the new field via the extended RPC.
- **`src/app/(internal)/queue/page.tsx`**: barber query becomes `.or('role.eq.barber,is_working_barber.eq.true')`.
- **`src/app/(internal)/payroll/payroll-client.tsx`**: same `.or(...)` on its barber-picker query.
- **`src/app/(internal)/attendance/page.tsx`**: render `BarberStatusToggle` when `role === 'barber' || is_working_barber`.
- **`src/app/(internal)/layout.tsx`**: `isBarber` becomes `role === 'barber' || is_working_barber`, so the "Kapster Dashboard" sidebar section renders alongside "Owner Dashboard" (both independently gated already, not mutually exclusive in the JSX).
- **`src/lib/supabase/types.ts`**: add `is_working_barber: boolean` to `Profile`.
- **`getCurrentProfile()`** (`src/lib/supabase/current-profile.ts`): confirm it already `select('*')`s the profile row (it does, per existing usage) — no query change needed, just the type addition above.

## Testing

- `npm run build` + targeted `eslint` on every touched file (established pattern this session).
- Manual verification via Staff Management: check "Kapster Aktif" on an owner-role profile, save, confirm — (a) they appear in Live Kapster Status on the public booking page once clocked in, (b) they're bookable, (c) they appear in the Queue walk-in dropdown, (d) they get the attendance clock-in/status toggle, (e) they appear in the Payroll barber picker and a commission run against their bookings produces a non-zero result, (f) sidebar shows both "Kapster Dashboard" and "Owner Dashboard" sections.
- Regression check: an ordinary `role = 'barber'` profile with `is_working_barber = false` (the default) behaves exactly as before in all six spots.
