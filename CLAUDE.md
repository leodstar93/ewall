# CLAUDE.md — EWALL App

Last updated: 2026-05-10

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

## 4. v3 UI Shell — Current Active Work

A new UI shell is being built under `app/v3/`. It replaces the v2 shell visually but reuses all existing API routes and business logic.

**Status:** early — layout, shell components, and some dashboard pages exist. No admin features ported yet.

Key files:
- `app/v3/layout.tsx` — root layout wrapper
- `app/v3/lib/themes.ts` — theme definitions (`navy` | `graphite` | `forest`, default `navy`)
- `app/v3/components/shell/ShellLayout.tsx` — main authenticated shell
- `app/v3/components/shell/Sidebar.tsx` — sidebar nav
- `app/v3/components/shell/Topbar.tsx` — top bar
- `app/v3/components/shell/nav-config/` — nav config types, `admin-nav.ts`, `dashboard-nav.ts`
- `app/v3/components/ui/` — v3 primitives: `Card`, `Pill`, `StatCard`, `PageHeader`, `SectionHeader`, `V3Icon`, `EwallLogo`
- `app/v3/(protected)/dashboard/` — customer dashboard pages (home, trucks, filings, documents, drivers, billing, support)
- `app/v3/(protected)/admin/` — admin overview page (stub)

When working on v3:
- Use CSS Modules (`.module.css` per component), not inline Tailwind classes on layout/shell elements.
- Follow existing v3 component patterns before introducing new primitives.
- All data fetching calls existing `api/v1` routes — do not create parallel v3 API routes.
- The old `app/(v3)/` route group was deleted; canonical v3 path is `app/v3/`.

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
