# EWALL Codex Context

Last updated: 2026-05-01

## 1. Product Mental Model

EWALL is a multi-tenant trucking compliance SaaS for Truckers Unidos. Treat it as a compliance operations system for trucking companies, not a single-user filing app.

Primary areas in the current codebase:

- IFTA v2 automation, plus legacy IFTA still present
- UCR filings
- Form 2290 filings
- DMV registrations and DMV renewal cases
- Truck/fleet records
- Documents and generated filing output
- Notifications
- Billing, subscriptions, coupons, grants, Stripe, PayPal, ACH custody
- ELD integrations, currently Motive-first
- Admin settings, RBAC, invitations, sandbox tooling, impersonation
- Public marketing/resources pages and authenticated v2 dashboard/admin shells

## 2. Current Stack

- Next.js 16.1.6 App Router
- React 19.2.3
- TypeScript 5
- Prisma 7.4.2 with PostgreSQL via `@prisma/adapter-pg`
- NextAuth v5 beta using JWT/session enrichment
- Tailwind CSS 4
- Stripe SDK and PayPal integration services/routes
- ACH secure vault and authorization models
- `pdf-lib`, `@pdf-lib/fontkit`, and `xlsx`
- `react-toastify` and `sweetalert2`

Useful scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run db:migrate:sandbox`
- `npm run db:push:sandbox`

## 3. Repository Shape

Important directories:

- `app/`: App Router pages, layouts, route groups, and API route handlers.
- `app/(public)`: public site pages.
- `app/(auth)`: login, logout, invite, forbidden flows.
- `app/(v2)`: authenticated v2 dashboard/admin shell and module pages.
- `app/api/v1`: main API surface, including the lightweight staff dashboard GraphQL endpoint.
- `app/api/v1/settings`: account, payment, company, and module settings APIs.
- `features/`: feature UI modules and module metadata.
- `services/`: business workflows and domain services.
- `lib/services/`: platform services such as organization, billing, entitlements, users, settings.
- `lib/`: auth, RBAC, Prisma clients, payments, validation, storage, navigation, utilities.
- `components/`: shared UI and feature widgets.
- `prisma/`: schema, migrations, seeds, sandbox bootstrap.
- `docs/`: module notes and migration docs.
- `v2/`: older/shared v2 shell assets and content.

Core rule: keep routes thin. New workflow logic belongs in `services/*` or `lib/services/*`, not inline in route handlers or UI components.

## 4. Routing And UI Surfaces

Main protected customer dashboard lives under:

- `app/(v2)/(protected)/dashboard`

Main protected admin area lives under:

- `app/(v2)/(protected)/admin`

Public pages live under:

- `app/(public)`

Feature metadata lives in `features/*/meta.json` and drives module labels, hrefs, icons, order, and permissions. Current notable feature modules:

- `features/ifta-v2` -> `/ifta-v2`, permission `ifta:read`
- `features/ucr` -> `/ucr`, permissions `ucr:read_own`, `ucr:read_all`
- `features/form2290` -> `/2290`, permission `compliance2290:view`
- `features/dmv` -> `/dmv`, permission `dmv:read`, currently `visible: false`
- `features/dmv-renewals` -> `/dmv/renewals`, permission `dmv:read`
- `features/trucks` -> `/trucks`, permission `truck:read`
- `features/documents` -> `/documents`, hidden, document/dashboard permissions

## 5. Tenant And Organization Model

The app is organization-first. In the current schema, `CompanyProfile` is the effective organization/tenant record. There is no separate `Organization` model in `schema.prisma`; `OrganizationMember` points to `CompanyProfile` through `organizationId`.

Key models:

- `User`
- `UserProfile`
- `CompanyProfile`
- `OrganizationMember`

Key service:

- `lib/services/organization.service.ts`

Use:

- `ensureUserOrganization(userId)`
- `getUserOrganizationId(userId)`
- `getUserOrganizationContext(userId)`

`ensureUserOrganization` creates or finds a `CompanyProfile`, upserts the owner `OrganizationMember`, and backfills unscoped `PaymentMethod` records with the organization id.

Do not bypass tenant scoping. Most records should be scoped by `organizationId`, `tenantId`, `userId`, or the relevant filing owner.

## 6. Auth, RBAC, And Access

Auth is in:

- `auth.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `types/next-auth.d.ts`

Session data includes roles and permissions. RBAC helpers:

- `lib/guards.ts` -> `requirePermission(permission)`
- `lib/rbac-api.ts` -> `requireApiPermission(permission)`
- `lib/rbac.ts`, `lib/rbac-core.ts`, `lib/authz.ts`
- `lib/guards/require-module-access.ts` -> page/module subscription gate

Admin role bypass exists. Staff can act as feature admin for modules listed in `STAFF_ADMIN_FEATURE_MODULES`.

Known issue: `lib/rbac-api.ts` still logs permission checks and session data with `console.log`. Avoid adding more sensitive auth logging.

## 7. Entitlements And Billing

Billing and entitlement models exist in Prisma:

- `BillingSettings`
- `AppModule`
- `SubscriptionPlan`
- `PlanModule`
- `OrganizationSubscription`
- `BillingCharge`
- `Coupon`
- `SubscriptionGrant`

Core services:

- `lib/services/entitlements.service.ts`
- `lib/services/billing.service.ts`
- `lib/services/billing-sync.service.ts`
- `lib/services/billing-settings.service.ts`
- `lib/services/subscription-engine.service.ts`
- `lib/payments/stripe.ts`
- `lib/payments/paypal.ts`

Access flow:

1. Resolve user organization with `ensureUserOrganization`.
2. Resolve module with `getModuleAccess(organizationId, moduleSlug)`.
3. Allow if module is active and one of these applies:
   - subscriptions disabled/not required
   - module is free
   - active grant exists
   - active/trialing/past-due-within-grace subscription includes module
   - internal role bypass is allowed

Important nuance: API entitlement gating in `requireApiPermission` currently hardcodes `ifta` and `ucr` in `API_MODULE_ACCESS_GATES`.

Billing/admin API surfaces include:

- `/api/v1/billing/*`
- `/api/v1/admin/billing/*`
- `/api/v1/internal/cron/billing`
- `/api/v1/webhooks/stripe`
- `/api/v1/stripe/webhook`
- `/api/v1/webhooks/paypal`

## 8. Prisma And Database Clients

Main Prisma entry:

- `lib/prisma.ts` exports `prismaProd`

Database split:

- `lib/prisma/prod.ts`
- `lib/prisma/sandbox.ts`
- `lib/db/resolve-db.ts` returns prod or sandbox client by environment

Schema is monolithic and large. Avoid broad model renames or cross-domain schema refactors unless the task explicitly requires it.

Known key model groups:

- Identity/RBAC: `User`, `Account`, `Session`, `Role`, `Permission`, `UserRole`, `RolePermission`
- Tenant: `CompanyProfile`, `OrganizationMember`
- Billing: `BillingSettings`, `AppModule`, `SubscriptionPlan`, `PlanModule`, `OrganizationSubscription`, `BillingCharge`, `Coupon`, `SubscriptionGrant`
- Financial custody: `PaymentMethod`, `AchSecureVault`, `AchAuthorization`, `FinancialAccessAudit`, `FilingPaymentUsage`
- Documents/notifications: `Document`, `Notification`
- Fleet/integrations: `Truck`, `IntegrationAccount`, `IntegrationSyncJob`, `IntegrationWebhookEvent`, `ExternalVehicle`, `ExternalDriver`
- IFTA v2: `IftaFiling`, `IftaPortalCredential`, `IftaJurisdictionProcedure`, `IftaFilingVehicle`, `RawIftaTrip`, `RawFuelPurchase`, `IftaDistanceLine`, `IftaFuelLine`, `IftaJurisdictionSummary`, `IftaQuarterSnapshot`, `IftaException`, `IftaAuditLog`
- Legacy IFTA: `IftaReport`, `IftaReportLine`, `Trip`, `TripMileage`, `FuelPurchase`
- UCR: `UCRRateBracket`, `UCRAdminSetting`, `UCRFiling`, `UCRCustomerPaymentAttempt`, `UCRDocument`, `UCRRateSnapshot`, `UCRWorkItem`, `UCRFilingEvent`, `UCRStatusTransition`
- 2290: `Form2290Setting`, `Form2290TaxPeriod`, `Form2290Filing`, `Form2290Correction`, `Form2290Document`, `Form2290ActivityLog`
- DMV: `DmvRegistration`, `DmvRenewal`, `DmvRenewalCase`, `DmvRegistrationJurisdiction`, `DmvRequirementTemplate`, `DmvRequirementSnapshot`, `DmvRegistrationDocument`, `DmvRenewalDocument`, `DmvRenewalCaseDocument`, `DmvRenewalCaseStatusHistory`, `DmvRenewalCaseMessage`, `DmvActivity`, `DmvFeeRule`
- Sandbox: `SandboxScenario`, `SandboxAuditLog`, `SandboxImpersonationSession`
- Invitations: `UserInvitation`

## 9. IFTA: Critical Distinction

There are two IFTA systems. Default to IFTA v2 unless the user explicitly asks for legacy IFTA.

Legacy IFTA:

- UI under `features/ifta`
- Services under `services/ifta`
- API under `/api/v1/features/ifta`
- Models include `IftaReport`, `IftaReportLine`, `Trip`, `TripMileage`, `FuelPurchase`

Active IFTA v2 automation:

- UI under `features/ifta-v2`
- Services under `services/ifta-automation`
- API under `/api/v1/features/ifta-v2`
- Canonical filing model is `IftaFiling`

Important IFTA v2 files:

- `features/ifta-v2/workspace.tsx`
- `features/ifta-v2/client-page.tsx`
- `features/ifta-v2/trucker-page.tsx`
- `features/ifta-v2/trucker-filing-page.tsx`
- `features/ifta-v2/staff-page.tsx`
- `features/ifta-v2/staff-queue-page.tsx`
- `features/ifta-v2/staff-filing-page.tsx`
- `features/ifta-v2/components/staff-ifta-instructions-panel.tsx`
- `services/ifta-automation/filing-workflow.service.ts`
- `services/ifta-automation/canonical-normalization.service.ts`
- `services/ifta-automation/sync-orchestrator.service.ts`
- `services/ifta-automation/raw-ingestion.service.ts`
- `services/ifta-automation/ifta-calculation-engine.service.ts`
- `services/ifta-automation/ifta-exception-engine.service.ts`
- `services/ifta-automation/snapshot.service.ts`
- `services/ifta-automation/export.service.ts`
- `services/ifta-automation/access.ts`
- `services/ifta-automation/security.ts`
- `services/ifta-automation/documents.ts`

## 10. IFTA v2 Workflow

Core flow:

1. User connects an ELD provider, currently Motive-first.
2. Sync creates/updates `IntegrationAccount`, raw provider records, external vehicles/drivers, and `IntegrationSyncJob`.
3. `CanonicalNormalizationService.ensureFiling` creates an `IftaFiling` by `tenantId`, year, quarter.
4. `CanonicalNormalizationService.rebuildFiling` builds canonical distance/fuel lines from raw data while preserving manual adjustments.
5. `IftaCalculationEngine` calculates jurisdiction summaries and totals.
6. `IftaExceptionEngine` evaluates blocking warnings/errors.
7. Client/trucker can add manual fuel, manual distance, submit, respond to requested changes, and client-approve.
8. Staff can claim/start review, recalculate/rebuild, edit manual jurisdiction summary, create/freeze snapshots, request changes, send for client approval, finalize, and reopen.

Important statuses include:

- `DRAFT`
- `DATA_READY`
- `READY_FOR_REVIEW`
- `IN_REVIEW`
- `CHANGES_REQUESTED`
- `SNAPSHOT_READY`
- `PENDING_APPROVAL`
- `APPROVED`
- `FINALIZED`
- `REOPENED`
- `ARCHIVED`

Important business rules:

- Manual fuel uses source type `MANUAL_ADJUSTMENT`.
- Manual distance also uses the manual adjustment source type.
- Submitted/approved/finalized filings have controlled edit/reopen paths.
- Blocking open exceptions prevent send-for-approval.
- Open error-severity exceptions prevent send-for-approval.
- `sendForApproval` creates and freezes a snapshot, then moves to `PENDING_APPROVAL`.
- Client approval moves `PENDING_APPROVAL` to `APPROVED`.
- Staff finalization moves `APPROVED` to `FINALIZED`.
- All meaningful transitions should write `IftaAuditLog`.
- Chat messages are stored as audit log rows with action `filing.chat_message`.
- Audit visibility is restricted; route logic only exposes audits to admins with `audit:read`.

## 11. IFTA v2 API Surface

Current route tree includes:

- `GET/POST /api/v1/features/ifta-v2/filings`
- `GET/PATCH /api/v1/features/ifta-v2/filings/[id]`
- `POST /api/v1/features/ifta-v2/filings/[id]/submit`
- `POST /api/v1/features/ifta-v2/filings/[id]/start-review`
- `POST /api/v1/features/ifta-v2/filings/[id]/claim`
- `PUT /api/v1/features/ifta-v2/filings/[id]/manual-fuel`
- `PUT /api/v1/features/ifta-v2/filings/[id]/manual-distance`
- `PUT/DELETE /api/v1/features/ifta-v2/filings/[id]/manual-summary`
- `POST /api/v1/features/ifta-v2/filings/[id]/recalculate`
- `POST /api/v1/features/ifta-v2/filings/[id]/rebuild`
- `POST /api/v1/features/ifta-v2/filings/[id]/create-snapshot`
- `POST /api/v1/features/ifta-v2/filings/[id]/approve`
- `POST /api/v1/features/ifta-v2/filings/[id]/client-approve`
- `POST /api/v1/features/ifta-v2/filings/[id]/finalize`
- `POST /api/v1/features/ifta-v2/filings/[id]/reopen`
- `POST /api/v1/features/ifta-v2/filings/[id]/request-changes`
- `GET/POST /api/v1/features/ifta-v2/filings/[id]/documents`
- `GET /api/v1/features/ifta-v2/filings/[id]/download`
- `GET /api/v1/features/ifta-v2/filings/[id]/exceptions`
- `POST /api/v1/features/ifta-v2/exceptions/[id]/ack`
- `POST /api/v1/features/ifta-v2/exceptions/[id]/ignore`
- `POST /api/v1/features/ifta-v2/exceptions/[id]/resolve`
- `POST /api/v1/features/ifta-v2/integrations/sync`
- `GET /api/v1/features/ifta-v2/integrations/sync-jobs`
- `POST /api/v1/features/ifta-v2/filings/[id]/reveal-portal-credentials`
- `GET /api/v1/features/ifta-v2/filings/[id]/staff-instructions`
- `GET /api/v1/features/ifta-v2/documents/[documentId]/download`

## 12. ELD Integrations

Core models:

- `IntegrationAccount`
- `IntegrationSyncJob`
- `IntegrationWebhookEvent`
- `ExternalVehicle`
- `ExternalDriver`
- `RawIftaTrip`
- `RawFuelPurchase`

Core services:

- `services/ifta-automation/provider-connection.service.ts`
- `services/ifta-automation/adapters.ts`
- `services/ifta-automation/sync-orchestrator.service.ts`
- `services/ifta-automation/raw-ingestion.service.ts`
- `services/ifta-automation/raw-eld-export.service.ts`
- `services/ifta-automation/legacy-trip-sync.service.ts`
- `lib/eld-provider-encryption.ts`
- `lib/integrations/providers.ts`

Routes:

- `/api/v1/integrations/eld/connect`
- `/api/v1/integrations/eld/callback/motive`
- `/api/v1/integrations/eld/confirm`
- `/api/v1/integrations/eld/disconnect`
- `/api/v1/integrations/eld/providers`
- `/api/v1/integrations/eld/status`
- `/api/v1/integrations/eld/webhooks/motive`

Motive is the first implemented provider. Keep provider-specific behavior behind adapter/service boundaries.

## 13. UCR

UI:

- `features/ucr`
- customer dashboard under `app/(v2)/(protected)/dashboard/ucr`
- admin queue/detail under `app/(v2)/(protected)/admin/features/ucr`

Services:

- `services/ucr/*`

Important services include:

- create/update/submit/resubmit filing
- start review, request correction, approve
- calculate pricing and snapshots
- checkout/customer payment attempts
- official receipt upload
- work item creation
- event/status transition logging
- compliance status

API surfaces include:

- `/api/v1/features/ucr/*`
- `/api/v1/admin/ucr/*`
- `/api/v1/settings/ucr-rates/*`
- `/api/v1/admin/settings/ucr`

## 14. Form 2290

UI:

- `features/form2290`
- admin settings under `app/(v2)/(protected)/admin/settings/2290`

Services:

- `services/form2290/*`

Core capabilities:

- create/update filing
- submit filing
- mark paid
- request correction
- attach/upload Schedule 1 and documents
- dashboard summary and compliance status
- tax period/settings management

API surfaces include:

- `/api/v1/features/2290/*`
- `/api/v1/settings/2290/*`
- sandbox mirrors under `/api/v1/sandbox/2290/*`

## 15. DMV

There are two related DMV areas.

DMV registration module:

- UI in `features/dmv`
- Services in `services/dmv`
- API in `/api/v1/features/dmv/*`
- Models include `DmvRegistration`, `DmvRenewal`, requirement snapshots, documents, fee rules, and activity.

DMV renewal case module:

- UI in `features/dmv-renewals`
- Services in `services/dmv-renewal`
- API in `/api/v1/features/dmv-renewals/*`
- Models include `DmvRenewalCase`, case documents, status history, messages.

Cron:

- `/api/v1/internal/cron/dmv`
- `/api/v1/features/dmv/cron`

Admin settings:

- `app/(v2)/(protected)/admin/settings/dmv`
- `/api/v1/features/dmv/settings/*`

## 16. Documents And Notifications

Documents:

- Model: `Document`
- Feature UI: `features/documents`
- Services: `services/documents/*`, `services/document-notifications.ts`, module-specific document services
- API: `/api/v1/features/documents/*`

Notifications:

- Model: `Notification`
- Services: `services/notifications.ts`, `lib/notifications.ts`, module-specific notification files
- UI: `components/notifications/NotificationBell.tsx`
- API: `/api/v1/notifications`, `/api/v1/notifications/[id]`, `/api/v1/notifications/mark-all-read`

Guideline: keep files attached to the owning filing/module record. Preserve notifications for workflow events, but avoid one-off notification code when a shared helper exists.

## 17. Financial Custody And Payments

ACH and sensitive financial access are explicit parts of the app.

Models:

- `PaymentMethod`
- `AchSecureVault`
- `AchAuthorization`
- `FinancialAccessAudit`
- `FilingPaymentUsage`

Core files:

- `lib/ach/*`
- `components/ach/StaffFilingPaymentPanel.tsx`
- `/api/v1/payment-methods/*`
- `/api/v1/filings/[filingType]/[filingId]/payment-usage/*`
- admin security page under `app/(v2)/(protected)/admin/settings/security/financial-access`

Rules:

- Do not expose raw financial data casually.
- Preserve audit records when revealing or using sensitive payment data.
- Keep payment usage scoped to filing type and filing id.

## 18. Sandbox And Impersonation

Sandbox support is implemented, not just planned.

Key areas:

- `prisma.sandbox.config.ts`
- `prisma/sandbox-bootstrap.sql`
- `lib/prisma/sandbox.ts`
- `lib/sandbox/*`
- `services/sandbox/*`
- `server/guards/requireSandboxAccess.ts`
- `/api/v1/sandbox/*`
- sandbox client/admin mirrors for UCR, 2290, IFTA legacy, DMV, documents
- `/api/v1/sandbox/reset`
- `/api/v1/sandbox/scenarios/load`
- `/api/v1/sandbox/impersonation/start`
- `/api/v1/sandbox/impersonation/stop`

Impersonation UI:

- `components/auth/ImpersonationBanner.tsx`
- `app/(v2)/components/auth/ImpersonationBanner.tsx`

Be careful not to mix sandbox and production Prisma clients.

## 19. Admin, Users, Invitations, Settings

Admin surfaces include:

- users
- truckers
- roles
- permissions
- staff filings
- billing plans/modules/coupons/grants/logs/settings
- integrations export/client settings
- news updates
- IFTA tax rates and IFTA jurisdiction process instructions
- UCR rates/settings
- DMV settings
- 2290 settings
- financial access/security

Related APIs:

- `/api/v1/users/*`
- `/api/v1/roles/*`
- `/api/v1/permissions/*`
- `/api/v1/admin/*`
- `/api/v1/invitations/*`
- `/api/v1/admin/invitations/*`

Invitation model:

- `UserInvitation`

## 20. Current Hazards And Technical Debt

1. Legacy IFTA and IFTA v2 coexist. Always verify which system a change targets.
2. `CompanyProfile` acts as the organization model. Do not assume there is a separate `Organization` Prisma model.
3. Dynamic route params use `params: Promise<...>` throughout the repo. This is an established local pattern; avoid large churn unless the task is specifically to normalize it.
4. `lib/rbac-api.ts` has debug logging around permissions/session data. Do not add more sensitive logs.
5. The Prisma schema is monolithic. Prefer narrow changes.
6. Billing is custom and cross-cuts module access. Test entitlement changes carefully.
7. IFTA v2 workflow side effects include status changes, audits, notifications, snapshots, and exception state. Keep them in services.
8. There are duplicate/parallel route surfaces such as `app/api/v1/webhooks/stripe` and `app/api/v1/stripe/webhook`. Check existing usage before changing.
9. Sandbox and prod clients coexist. Use `getDbForEnvironment` or established sandbox services when working in sandbox routes.
10. Some files may contain encoding artifacts from older context/docs. Keep new edits ASCII unless a file already requires otherwise.

## 21. Codex Working Rules For This Repo

- Default to IFTA v2 for IFTA work.
- Do not touch legacy IFTA unless explicitly requested.
- Keep business logic out of route handlers.
- Preserve organization/tenant scoping.
- Preserve RBAC and module entitlement checks.
- Preserve audit logs for filing, financial, and sensitive actions.
- Preserve notification side effects when changing workflow transitions.
- Use existing service patterns and existing Prisma model names.
- Prefer additive, narrow edits over architectural rewrites.
- Check feature metadata before adding dashboard/admin navigation.
- For frontend work, match the existing v2 dashboard/admin shell and module patterns.
- For billing/payment work, review both provider routes and internal subscription engine behavior.
- For sandbox work, confirm which DB client/environment is active before writing data.

## 22. Fast Orientation Checklist

Before changing a feature:

1. Read the relevant `features/*/meta.json`.
2. Read the page/client component under `features/*` or `app/(v2)/(protected)/*`.
3. Read the matching API route under `app/api/v1`.
4. Read the domain service under `services/*` or `lib/services/*`.
5. Confirm Prisma models and status enums in `prisma/schema.prisma`.
6. Check permissions, entitlements, tenant scoping, audits, and notifications.
7. Run at least `npm run build` or a narrower validation if the change is non-trivial.
