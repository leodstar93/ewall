# CLAUDE.md — EWALL App

Last updated: 2026-05-10 (v3 design system added)

> Full domain detail lives in `CODEX_CONTEXT.md`. This file gives Claude Code fast orientation and working rules for every session.

---

## 1. What This Is

EWALL is a multi-tenant trucking compliance SaaS for **Truckers Unidos**. It is not a single-user filing app. Every action must be scoped to an organization (tenant). Primary modules: IFTA v2 automation, UCR, Form 2290, DMV renewals, Fleet/Trucks, Billing, ELD integrations, Admin/RBAC.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 App Router, React 19, TypeScript 5 |
| Database | PostgreSQL + Prisma 7.4.2 (`@prisma/adapter-pg`) |
| Auth | NextAuth v5 beta, JWT session enrichment |
| Styling | Tailwind CSS 4 + CSS Modules (per component) |
| Payments | Stripe, PayPal, ACH secure vault |
| PDFs/Export | `pdf-lib`, `@pdf-lib/fontkit`, `xlsx` |
| ELD | Motive (OAuth, webhooks) |
| Email | Resend (`RESEND_API_KEY`) |
| Deployment | VPS + PM2 + Linux cron (not Vercel) |

Scripts: `npm run dev` · `npm run build` · `npm run lint` · `npm run db:migrate:sandbox` · `npm run db:push:sandbox`

---

## 3. Repository Map

```
app/
  (public)/           public marketing pages
  (auth)/             login, logout, invite, forbidden
  (v2)/(protected)/   STABLE — main dashboard + admin (v2 shell)
  v3/(protected)/     IN PROGRESS — new UI shell (see §4)
  api/v1/             all API routes
features/             feature UI modules + meta.json
services/             domain workflow services
lib/services/         platform services (billing, org, users, entitlements)
lib/                  auth, RBAC, Prisma clients, payments, ACH, ELD encryption
components/           shared UI widgets
prisma/               schema.prisma, migrations, seeds
docs/                 migration notes
```

Core rule: **routes stay thin**. Business logic belongs in `services/*` or `lib/services/*`.

---

## 4. v3 UI Shell — Design System & Current State

The v3 shell is a professional redesign by Claude Design, implemented under `app/v3/`. It reuses ALL existing `api/v1` routes and business logic — only the UI layer changes.

### Design origin
- Designed in Claude Design (claude.ai/design) from the file `CODEX_CONTEXT.md`
- Font: **Inter** (all weights)
- Grid: **8px** base, `10–12px` border-radius, soft shadows
- Three themes: **navy** (default), **graphite**, **forest**
- Two portals: **Admin/Staff shell** (`Ewall Dashboard`) and **Client portal** (`Ewall Client`)

### Design tokens — `app/v3/layout.module.css`

All tokens are CSS custom properties on `.v3Root`. Use them everywhere:

```
--v3-bg           warm off-white surface (#F6F5F1 navy)
--v3-panel        white card background
--v3-ink          near-black text (#0E1116)
--v3-muted        secondary text (#5B6470)
--v3-line         border (#E7E4DC)
--v3-soft-line    divider / lighter border
--v3-chip-bg      chip/tag background
--v3-primary      deep navy (#15233D) — CTA buttons, hero bands
--v3-primary-soft soft navy tint — info banners
--v3-accent       brass (#B5895A) — active indicator, avatar gradient, highlights
--v3-sb-bg        sidebar dark background (#0E1116)
--v3-sb-ink / --v3-sb-muted / --v3-sb-hover / --v3-sb-active
--v3-success / --v3-success-bg
--v3-warn / --v3-warn-bg
--v3-danger / --v3-danger-bg
--v3-info / --v3-info-bg
--v3-sidebar-w (252px) / --v3-sidebar-w-collapsed (72px)
--v3-topbar-h (60px)
--v3-font  'Inter', system-ui, sans-serif
```

Graphite and Forest override tokens via `data-theme` attribute on `.v3Root`.

### UI primitives — `app/v3/components/ui/`

| Component | Props | Notes |
|---|---|---|
| `Card` | `noPadding?`, `style?` | `border-radius: 12px`, `border: 1px solid --v3-line` |
| `Pill` | `tone: 'success'\|'warn'\|'danger'\|'info'\|'neutral'` | Dot + label, uses semantic color tokens |
| `StatCard` | `label`, `value`, `delta?`, `deltaTone?`, `sub?` | KPI card with optional sparkline area |
| `SectionHeader` | `title`, `subtitle?`, `action?` | Card header row with optional right slot |
| `PageHeader` | `title`, `subtitle?`, `action?` | Page-level header |
| `V3Icon` | `name: IconName`, `size?`, `stroke?` | SVG icon set (see `V3Icon.tsx` for full list) |
| `EwallLogo` | `size?`, `color?` | E/T logomark SVG |

### Shell — `app/v3/components/shell/`

- `ShellLayout.tsx` — wraps Sidebar + Topbar + `<main>`. Props: `navGroups`, `title`, `breadcrumb`, `userName`, `userRole`, `userInitials`, `orgName`
- `Sidebar.tsx` — dark sidebar with brand, collapsible nav groups, Settings link, user avatar footer
- `Topbar.tsx` — sticky header with page title, breadcrumb, search button, **notification bell dropdown** (6 items, unread count, mark-all-read)
- `ShellLayout.module.css`, `Sidebar.module.css`, `Topbar.module.css`

### Navigation configs — `app/v3/components/shell/nav-config/`

```
types.ts          NavItem { id, label, href, icon, badge?, permission? }
                  NavGroup { label?, items }

admin-nav.ts      adminNavGroups  — for ADMIN role
                  staffNavGroups  — for STAFF role (Workspace + Compliance only)

dashboard-nav.ts  dashboardNavGroups — for TRUCKER/client portal
```

**Admin nav structure:**
```
Workspace     Overview, Documents
Compliance    IFTA (badge 3), UCR, Form 2290, DMV renewals (badge 7)
Operations    Reports, Team          ← admin only
Settings      (footer link)
```

**Staff nav structure (STAFF = same business actions as Admin, but no Operations/Settings):**
```
Workspace     Overview, Documents
Compliance    IFTA (badge 3), UCR, Form 2290, DMV renewals (badge 7)
```

**Client/Trucker nav structure:**
```
Workspace     Overview, Fleet (badge 8), Filings (badge 2), Documents, Drivers
Account       Billing, Get help
```

> Fleet lives ONLY in the client portal. It is NOT in the admin/staff shell.

### Role model in v3

| Role | Shell | Access |
|---|---|---|
| `ADMIN` | Admin shell (`/v3/admin`) | Full: Workspace, Compliance, Operations, Settings |
| `STAFF` | Admin shell (`/v3/admin`) | Workspace + Compliance only. Same business actions as Admin; only Settings (system rates, fees, templates) is blocked |
| `TRUCKER` | Client portal (`/v3/dashboard`) | Their own fleet, filings, documents, billing |

### v3 pages — current state

All pages use **static mock data** (no API calls yet). UI is complete; backend integration is pending.

**Client portal `/v3/dashboard`** — all pages implemented:

| Route | File | What it shows |
|---|---|---|
| `/v3/dashboard` | `home.tsx` | Welcome hero (company info, truck count, open to-dos), 3 action cards (Pay UCR / Sign IFTA / Upload receipts), filing stepper (IFTA Q2, UCR, 2290), fleet preview table (5 trucks), Updates from Ewall feed, bilingual help band |
| `/v3/dashboard/trucks` | `trucks/trucks.tsx` | 4 stat cards (Total/On road/Maintenance/Idle), trucks table (6 rows: Unit, VIN, Plate, Driver, Odometer, Status), + Add truck button |
| `/v3/dashboard/filings` | `filings/filings.tsx` | Info card about filing workflow, filings table (5 rows: IFTA Q2/Q1/Q4, UCR, Form 2290 — Status, Amount, Due/Filed, View button), + Start a filing button |
| `/v3/dashboard/documents` | `documents/documents.tsx` | Drag-drop upload card, documents table (5 rows: COI, fuel receipts, Schedule 1, TX registration, CDL renewal — Tag, Size, Uploaded, download button) |
| `/v3/dashboard/drivers` | `drivers/drivers.tsx` | Drivers table (6 rows: name, CDL, expiry with 60-day warning, Truck, Status, Phone), + Add driver button |
| `/v3/dashboard/billing` | `billing/billing.tsx` | Current plan card (Fleet $89/mo, 8/25 trucks, next charge), payment method card (Visa), invoices table (5 paid invoices), Change plan / Update card buttons |
| `/v3/dashboard/support` | `support/support.tsx` | Hero support card (bilingual, 7am–7pm CT, Start chat / Schedule call), 6 topic cards (IFTA/UCR/2290/DMV/Docs/Drivers), conversations feed (3 items) |

**Admin/Staff shell `/v3/admin`** — overview and settings implemented, compliance feature pages pending:

| Route | File | What it shows |
|---|---|---|
| `/v3/admin` | `overview.tsx` | Greeting strip (personalized), 4 stat cards (11 compliance open, 38 filings MTD $48k, 18 active units, $268 avg cost), compliance queue table (4 filings with progress bars), fleet snapshot table (5 trucks, status filter tabs), live fleet map visualization (7 units + legend), activity feed (5 items), footer band (Smart assistant, week's payments, support card) |
| `/v3/admin/settings` | `settings/settings.tsx` | 11-section settings (side-nav): IFTA tax rates (quarter selector, sync banner, scrollable state table), UCR fee schedule (3 stat cards + brackets), Form 2290 HVUT brackets, DMV fees by state, Jurisdictions (interactive 48-state grid), Service fees, Filing workflows (toggles + SLA cards), Roles & permissions matrix (6 roles), News & updates (posts table + composer), Email templates (10 templates + IFTA editor + variable panel + preview), System & branding (org info + data retention) |

**Client portal settings:**

| Route | File | What it shows |
|---|---|---|
| `/v3/dashboard/settings` | `settings/settings.tsx` | 6-section settings (side-nav): Company profile (name, EIN, address, MC/DOT, contact), Billing & plan (current plan card, Stripe payment method, invoices table), Integrations (Motive ELD, QuickBooks, IFTA Plus toggles), Notifications (per-event toggles for email/SMS/push), Security (2FA setup, active sessions table), Audit log (activity table with export) |

**Shared settings CSS:** `app/v3/components/ui/settings.module.css` — both portals import this. Contains `.page`, `.sidenav`, form primitives, toggle, table, and stat-mini-card classes.

**Layouts with auth:**
- `dashboard/layout.tsx` — ShellLayout with `dashboardNavGroups`, role "Fleet admin", redirects to login if no session
- `admin/layout.tsx` — ShellLayout with `adminNavGroups`, role "Staff", org "Truckers Unidos · Ops", redirects to login if no session

### Design pages NOT yet in v3

These were designed in Claude Design and need to be built:

| Priority | Page | Location | Notes |
|---|---|---|---|
| Medium | **IFTA list + detail** | `/v3/admin/features/ifta-v2` | Filing queue, per-quarter jurisdiction breakdown bars |
| Medium | **UCR list + detail** | `/v3/admin/features/ucr` | Multi-year registrations, bracket, fee, certificate numbers |
| Medium | **Form 2290 list + detail** | `/v3/admin/features/2290` | Vehicle-by-vehicle HVUT table, Schedule 1 download card |
| Medium | **DMV renewals list + detail** | `/v3/admin/features/dmv` | Days-left pills, auto-renew status, bulk renew action |
| Medium | **Individual filing detail** | `/v3/admin/features/[module]/[id]` | Step tracker, documents, chat/messages panel, role-aware actions |
| Low | **Reports** | `/v3/admin/reports` | Saved + custom reports grid (admin only) |
| Low | **Team** | `/v3/admin/users` | Members, roles, status, last seen |

### v3 coding rules

- Use CSS Modules (`.module.css` per component), not inline Tailwind on layout/shell elements.
- Inline styles are acceptable for one-off data-driven values (colors from tokens, dynamic widths).
- Follow existing component patterns (`Card`, `Pill`, `V3Icon`) before introducing new primitives.
- All data goes through existing `api/v1` routes — never create parallel v3 API routes.
- The old `app/(v3)/` route group (with parentheses) was deleted. Canonical path is `app/v3/` (no parentheses).
- When adding pages, pass the correct `navGroups` (admin vs staff vs dashboard) to `ShellLayout`.
- For role-aware nav, select `adminNavGroups` vs `staffNavGroups` from `admin-nav.ts` based on session role.

---

## 5. Tenant & Auth Model

- `CompanyProfile` = the organization/tenant record. There is no separate `Organization` Prisma model.
- `OrganizationMember` links `User` → `CompanyProfile`.
- Always call `ensureUserOrganization(userId)` (from `lib/services/organization.service.ts`) before creating records.
- Never bypass tenant scoping. Records must carry `organizationId`, `tenantId`, or filing-owner scope.
- Session carries `roles[]` and `permissions[]`. Use `lib/guards.ts` (`requirePermission`) for pages and `lib/rbac-api.ts` (`requireApiPermission`) for API routes.
- Admin impersonation is active — check `token.impersonationActive` / `token.actorUserId` in auth callbacks.

---

## 6. IFTA — Critical Distinction

Two IFTA systems coexist. **Always default to IFTA v2** unless the user explicitly asks for legacy IFTA.

| | Legacy IFTA | IFTA v2 (active) |
|---|---|---|
| UI | `features/ifta` | `features/ifta-v2` |
| Services | `services/ifta` | `services/ifta-automation` |
| API | `/api/v1/features/ifta` | `/api/v1/features/ifta-v2` |
| Key model | `IftaReport` | `IftaFiling` |

IFTA v2 statuses: `DRAFT → DATA_READY → READY_FOR_REVIEW → IN_REVIEW → CHANGES_REQUESTED → SNAPSHOT_READY → PENDING_APPROVAL → APPROVED → FINALIZED → REOPENED → ARCHIVED`

---

## 7. Top Hazards

1. **Two IFTA systems** — always confirm which one before touching IFTA code.
2. **`CompanyProfile` = org** — no `Organization` model exists in Prisma.
3. **`params` are async** — `params: Promise<{ id: string }>` is the established pattern here; don't refactor it.
4. **Sandbox vs prod DB** — never mix. Use `getDbForEnvironment()` or sandbox-specific services in `/api/v1/sandbox/*` routes.
5. **Duplicate webhook routes** — both `/api/v1/webhooks/stripe` and `/api/v1/stripe/webhook` exist. Check existing usage before changing either.
6. **Monolithic Prisma schema** — `prisma/schema.prisma` is ~2450 lines. Make narrow, additive changes.
7. **RBAC debug logs** — `lib/rbac-api.ts` already has `console.log` on permissions. Do not add more sensitive auth logging.
8. **Billing cross-cuts entitlements** — changes to subscription logic can break module access gates. Test carefully.

---

## 8. Billing & Entitlements Flow

1. `ensureUserOrganization(userId)` → get `organizationId`
2. `getModuleAccess(organizationId, moduleSlug)` → check active subscription/grant/free flag
3. API gate at `requireApiPermission` checks `API_MODULE_ACCESS_GATES` (currently hardcodes `ifta`, `ucr`)

Key services: `lib/services/entitlements.service.ts`, `lib/services/billing.service.ts`, `lib/services/subscription-engine.service.ts`

---

## 9. Financial & ACH Rules

- Do not expose raw ACH/payment data outside audit-logged paths.
- Always write `FinancialAccessAudit` when revealing or using sensitive payment data.
- Keep payment usage scoped to `filingType` + `filingId`.
- Core: `lib/ach/*`, `components/ach/StaffFilingPaymentPanel.tsx`

---

## 10. Working Rules

- Keep routes thin — logic in services, not handlers or components.
- Preserve tenant scoping on every new record.
- Preserve RBAC + entitlement checks when adding/modifying pages or API routes.
- Write `IftaAuditLog` / `DmvActivity` / `UCRFilingEvent` for all meaningful state transitions.
- Fire notification side effects when changing workflow transitions.
- Use existing Prisma model names and service patterns — don't rename or abstract unless the task requires it.
- Prefer additive, narrow edits over rewrites.
- Default to no comments. Add one only when the WHY is non-obvious.
- For v3 UI work: start dev server, test the golden path in-browser before marking done.
- Check `features/*/meta.json` before adding nav items to dashboard or admin.

---

## 11. Pre-Task Checklist

Before modifying any feature:

1. Read `features/*/meta.json` for the module.
2. Read the page/component under `features/*` or `app/(v2)/(protected)/*` (or `app/v3/` if v3 work).
3. Read the matching API route under `app/api/v1`.
4. Read the domain service under `services/*` or `lib/services/*`.
5. Check Prisma models and enums in `prisma/schema.prisma`.
6. Confirm tenant scoping, RBAC, entitlements, audits, and notifications.
7. Run `npm run build` or `npm run lint` before finishing non-trivial changes.

---

## 12. Deep Reference

For full domain detail, read `CODEX_CONTEXT.md`. It covers:
- Full IFTA v2 workflow and API surface (§10–11)
- UCR, Form 2290, DMV module details (§13–15)
- ELD integration architecture (§12)
- Documents & notifications patterns (§16)
- Sandbox and impersonation (§18)
- Admin surfaces and invitations (§19)
