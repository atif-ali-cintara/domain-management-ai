## Goal
Build a Domain Management Dashboard alongside the existing Domain Hunter, sharing the same Lovable Cloud project. Phase 1 ships every module from the spec (Dashboard, Domain List, Domain Detail, Identities, Companies, Registrars, Payment Methods, Tasks, Reports) plus a one-click import from Domain Hunter. Authenticated users have full access; roles deferred to Phase 2.

## Architecture

- **Auth**: enable Lovable Cloud, email/password + Google sign-in, `/auth` route, protected app under `_authenticated/` (managed gate).
- **Domain Hunter coexistence**: keep current `/` Hunter UI working. Move dashboard under `/app/*`. Add a top-level switcher in the header.
- **Data model**: Postgres tables per spec with RLS = any authenticated user can read/write Phase 1 (single-tenant assumption). Foreign keys enforced. Triggers for `audit_log` and auto-task generation. A view computes `domain_age`, `days_to_expiry`, and `risk_badge` from row data.
- **Server work**: `createServerFn` for CSV import/validation, duplicate detection, Hunter→Domain import, scheduled-report-style aggregations, and CSV/PDF export.
- **UI**: shadcn tables with TanStack Table (sort/filter/bulk select), Recharts for dashboard charts, react-hook-form + zod for all forms, sonner for toasts.

## Modules (build order)

1. **Cloud + Auth**: enable Cloud, `/auth` page (email/password + Google), `_authenticated/` shell, header with nav between Hunter and Dashboard, sign-out.
2. **Schema migration**: all tables in spec — `providers`, `identities`, `companies`, `registrar_accounts`, `payment_methods`, `domains`, `tasks`, `audit_log`. GRANTs + RLS (auth-only). Seed `providers` with GoDaddy, Namecheap, Cloudflare, Porkbun, Google Domains, Other. Generated columns / view for derived fields.
3. **Lookup pages** (`/app/identities`, `/app/companies`, `/app/registrars`, `/app/payment-methods`): list + create/edit drawer, linked-domains count, status, alerts (expiring payment methods, missing 2FA, identities with no linked domain).
4. **Domain List** (`/app/domains`): full-featured table with every filter in spec, bulk edit, CSV export, CSV import wizard (template download, column-mapping preview, validation, duplicate detection, commit), risk badge cell.
5. **Domain Detail** (`/app/domains/$id`): tabs Overview / Ownership / Registration / Payment / Usage / Campaigns (placeholder) / Tasks / Reports / History / Notes. History reads from `audit_log`.
6. **Dashboard** (`/app/`): CEO Summary vs Operations toggle, metric cards, expiry/criticality charts, recent purchases, "needs setup" list. Filter bar applies to all tiles.
7. **Tasks & Alerts** (`/app/tasks`): auto-generated tasks (renewal ≤30d, auto-renew off + critical, missing owner/payment, payment method expiring) via SQL function + trigger; manual tasks CRUD; in-app notification bell. Email left as Phase 2 hook (sender stubbed).
8. **Reports** (`/app/reports`): predefined report templates from spec, each with CSV export; "Critical issues" PDF export via server fn (HTML→PDF using `@react-pdf/renderer`); UI for scheduling stored in `report_schedules` table (cron execution itself is Phase 2 — surfaced as "scheduled, runs weekly" badge).
9. **Domain Hunter import**: add "Import to Dashboard" action on Hunter cart/results that calls a server fn writing rows with `source='domain_hunter'`, `hunt_id`, `branch`, `cart_status`, `approval_status='pending'`. Default new rows to status `Needs Setup`.

## Derived fields & risk badge

- `domain_age` = `now() - date_bought` (computed in view).
- `days_to_expiry` = `expiration_date - now()`.
- `risk_badge`: Red if expired or ≤14d & auto-renew off & critical; Yellow if ≤60d or missing owner/payment; Gray if status Archived/Retired; else Green.

## Out of scope (Phase 2, stubbed)

WHOIS auto-fetch, DNS checks, Campaign module wiring, reputation metrics, saved views, role-based permissions, email delivery, real cron execution.

## Files touched (high level)

- `supabase/migrations/<ts>_dmd_schema.sql` (tables, RLS, GRANTs, triggers, seed)
- `src/integrations/lovable/*` already present from Cloud
- `src/routes/auth.tsx`
- `src/routes/_authenticated/route.tsx` (managed)
- `src/routes/_authenticated/app/index.tsx` (Dashboard)
- `src/routes/_authenticated/app/domains.tsx` + `domains.$id.tsx` + `domains.import.tsx`
- `src/routes/_authenticated/app/identities.tsx`, `companies.tsx`, `registrars.tsx`, `payment-methods.tsx`
- `src/routes/_authenticated/app/tasks.tsx`, `reports.tsx`
- `src/lib/dmd/*.functions.ts` (csv-import, hunter-import, reports, pdf-export, task-generation)
- `src/components/dmd/*` (DataTable, FilterBar, RiskBadge, MetricCard, ImportWizard, DomainForm, etc.)
- `src/routes/index.tsx` (Hunter — add "Import to Dashboard" buttons + header link)
- `src/routes/__root.tsx` (auth listener, app shell nav)

## Confirmation before I start

This is a large Phase 1. I'll execute in the order above and check in after step 4 (Domain List + CSV import working end-to-end) so you can validate the schema and table UX before I extend it to reports/tasks/dashboard polish.
