# CODEX_CONTEXT_UPDATED.md

Project: EWALL (Truckers compliance SaaS)

Last updated: 2026-04-18  
Confidence note: This update is grounded in the provided context file plus the implementation details described in recent project work inside this workspace. Direct live inspection of the GitHub repository was attempted but was not available from the current environment, so any item marked **verify-in-repo** should be confirmed against the latest code before large refactors.

## 1. Product overview

EWALL is a multi-tenant trucking compliance SaaS focused on carrier operations and filing workflows. Current known modules and platform areas include:

- IFTA
  - Legacy IFTA flow still exists in the codebase
  - IFTA v2 is the active filing workflow and the default target for new work
- UCR
- Form 2290
- DMV registration / renewal workflows
- Billing and subscriptions
- Document exchange between client and staff
- Notifications
- Admin settings / sandbox tooling
- ELD integrations, with Motive as the first provider

Core mental model:

> Multi-tenant compliance operating system for trucking companies, not a single-user filing app.

## 2. Current stack

- Next.js App Router
- React
- TypeScript
- Prisma + PostgreSQL
- NextAuth v5 with JWT/session enrichment
- TailwindCSS
- Tostify
- SweetAlert
- Stripe already integrated
- PayPal present or planned depending on module surface
- pdf-lib for PDF generation
- xlsx for Excel exports

## 3. Architectural rules

These rules are critical and should be preserved in all Codex work:

1. Keep routes thin.
2. Put business logic in `/services`.
3. Do not bypass entitlement / permission checks.
4. Preserve auditability for filing actions.
5. Prefer additive changes over broad refactors.
6. Do not extend broken patterns already known in the repo.
7. For IFTA work, default to v2 unless the task explicitly says legacy.

## 4. Tenant and organization model

The system is organization-first.

Known model assumptions:

- Each user must belong to an organization
- Access is scoped by organization / company profile
- Billing and entitlements are organization-based
- Staff/client workflows should always resolve organization scope first

**verify-in-repo**
- Whether `CompanyProfile` is still acting as the effective organization record everywhere
- Whether there is now a separate `Organization` model or not

## 5. Auth and RBAC

Known auth pattern:

- NextAuth v5
- Credentials provider
- Google provider
- JWT/session enriched with:
  - `user.id`
  - `roles[]`
  - `permissions[]`

Known authorization pattern:

- Page guards use permission helpers
- API handlers use API permission helpers
- Admin role bypass exists

Guideline:

- Keep authorization checks centralized
- Do not duplicate permission logic inside UI components

## 6. Billing and entitlement model

Known entitlement direction:

- App modules can be gated by subscription / grants
- Access is checked at organization level
- Stripe is already integrated
- Subscription management is intended to support:
  - enable/disable subscription system
  - configurable prices
  - coupons / discounts
  - gifted subscriptions
  - module-based entitlement mapping

Known billing engine behavior from prior work:
- Internal billing cron exists or is planned at `/api/v1/internal/cron/billing`
- Handles retries / past due / replacement behavior

**verify-in-repo**
- exact Prisma names for:
  - `AppModule`
  - `SubscriptionPlan`
  - `PlanModule`
  - `OrganizationSubscription`
  - `SubscriptionGrant`
  - `Coupon`
  - `BillingCharge`

## 7. IFTA: repo reality to assume by default

### 7.1 Important distinction

There are two IFTA systems in the project:

#### Legacy IFTA
Older structures such as:
- `IftaReport`
- `Trip`
- `FuelPurchase`

Do not touch unless the task explicitly requires legacy support.

#### Active IFTA system: IFTA v2
Use this by default for new work.

Known entities from the current project direction:
- `IftaV2Filing` or `IftaFiling` (**verify exact naming in schema**)
- raw trip ingestion
- raw fuel purchase ingestion
- jurisdiction summaries / lines
- quarter snapshots
- exceptions
- audit logs

### 7.2 Confirmed workflow direction from recent implementation work

Client / trucker flow:
1. Connect Motive
2. Open or create filing for a quarter
3. Sync data
4. Add manual fuel when needed
5. Review status and notes
6. Submit or continue requested changes

Staff flow:
1. See filing request queue
2. Sync or refresh provider data
3. Calculate filing
4. Create snapshot
5. Approve per filing
6. Leave notes visible to client

### 7.3 Known files and structure from recent implementation work

These paths were referenced in recent project work and should be treated as likely current unless repo inspection shows otherwise:

- `app/(dashboard)/ifta-v2/page.tsx`
- `features/ifta-v2/client-page.tsx`
- `features/ifta-v2/staff-page.tsx`
- `app/api/v1/features/ifta-v2/filings/route.ts`
- `services/ifta/v2/filings/filingWorkflow.service.ts`
- `services/integrations/eld/providers/motive/motive.service.ts`
- `app/api/v1/integrations/eld/callback/motive/route.ts`
- `lib/ui/status-utils.ts`

### 7.4 Workflow services

Known critical service responsibilities:

#### Filing workflow service
Responsible for:
- manual fuel updates
- submission
- review transitions
- approval transitions
- reopen flows if allowed
- notes / audit writes

#### Normalization / calculation services
Responsible for:
- ingesting provider data
- normalizing vehicles / trips / fuel
- generating distance lines
- generating fuel lines
- rebuilding filing views from raw data

Guideline:
- new filing logic belongs in services, not route handlers

### 7.5 Business rules that should not be broken

- Manual fuel adjustments should remain explicitly typed and auditable
- Approved filings should be immutable, or nearly immutable with controlled reopen flow
- Final approval should require a frozen snapshot
- Blocking exceptions must prevent approval
- All filing state transitions should be logged

## 8. ELD integrations

Motive is the first known provider.

Known recent behavior:
- OAuth callback routing was adjusted so users return to the correct flow after Motive connect
- Integration design is moving toward provider-agnostic architecture after Motive-first implementation

Guideline:
- Build provider adapters behind a shared service contract
- Keep provider-specific code isolated under integrations/services

## 9. UCR module direction

Known desired UCR flow:

1. Admin configures UCR brackets / rates
2. Client creates annual filing
3. Staff reviews filing
4. Staff requests corrections if needed
5. Client uploads proof / receipt if applicable
6. Staff approves
7. Filing becomes compliant
8. Dashboard reflects compliance status

Operational note:
- There is interest in a “customer pays inside EWALL, staff pays manually on official site, then uploads receipt” operational model

## 10. 2290 module direction

Known product direction:
- 2290 is part of the compliance module set
- It should fit the same organization-scoped client/staff filing pattern
- Keep billing, documents, and notifications reusable across modules

## 11. DMV module direction

Known DMV direction from recent planning:
- Support registration and renewal workflow
- Client uploads initial document(s)
- Staff works the renewal/registration
- Staff uploads result documents back to client
- Client gets notified and may provide final acknowledgment/approval depending on workflow

Guideline:
- Reuse the shared filing/document pattern rather than inventing a separate ad hoc flow

## 12. Documents and notifications

Known platform expectation:
- Modules exchange documents between client and staff
- Notifications should be used for workflow events
- Receipt / proof / generated output should be stored per filing or module instance

Guideline:
- Keep document references associated with the owning filing / module record
- Avoid module-specific one-off notification logic when shared infra can be used

## 13. Admin / settings surfaces

Known or planned admin areas:
- IFTA tax rates
- subscription/billing settings
- module activation
- sandbox/admin testing tools

Specific IFTA settings direction:
- Admin “Settings” tab for jurisdiction fuel tax rates for all US jurisdictions
- current manual-entry-first design should preserve future compatibility with CSV import and ELD import

## 14. Known technical debt / hazards

These are recurring repo risks and should influence how Codex changes are made:

1. Legacy and new IFTA systems coexist  
   Easy to modify the wrong models/services.

2. Monolithic Prisma schema  
   Hard to reason about and easy to break with wide refactors.

3. Outdated Prisma helper assumptions  
   Some shared helper code may reference stale model names.

4. Non-standard dynamic params typing  
   The repo has had patterns like `params: Promise<{ id: string }>` that should not be extended.

5. Debug-heavy auth / RBAC code  
   Avoid leaking sensitive information in logs.

6. Tight coupling of workflow side effects  
   Notifications, audit logs, and state changes may be too intertwined.

7. Custom billing engine risk  
   Subscription lifecycle bugs can affect access across modules.

## 15. Codex instructions for this repo

When generating code or specs for EWALL:

- Default to IFTA v2, not legacy IFTA
- Keep logic in services
- Preserve audit logs
- Preserve organization scoping
- Preserve permission and entitlement checks
- Do not rename Prisma models unless truly necessary
- Prefer small safe additions over broad architectural rewrites
- Reuse shared filing/document/notification patterns across modules
- Avoid introducing route-level business logic
- Avoid extending bad `params: Promise<...>` patterns

## 16. Recommended next verification pass

Before any large codegen task, verify these directly in repo:

1. exact Prisma schema names for tenant, billing, IFTA v2, and document models
2. current IFTA v2 API route tree under `app/api/v1/features/ifta-v2`
3. actual ELD provider abstraction layout
4. whether `IftaV2Filing` or `IftaFiling` is the canonical filing model name
5. whether sandbox/admin tooling has already landed in code
6. whether PayPal is implemented, partial, or planned only

## 17. Short operational summary

EWALL is a multi-tenant trucking compliance SaaS with organization-based auth, entitlements, and workflow processing. The most active and sensitive area is IFTA v2, especially Motive-driven filing workflows between trucker and staff. Codex should treat the services layer as the real application core, preserve auditability and org scoping, and avoid touching legacy IFTA unless explicitly requested.
