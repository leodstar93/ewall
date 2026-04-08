Project: EWALL (Truckers Unidos SaaS)
1. Overview

EWALL is a Next.js App Router SaaS platform for trucking compliance and operations. It supports:

IFTA (v1 legacy + v2 automation)
UCR filings
Form 2290
DMV registration & renewal
Billing & subscriptions (Stripe + PayPal)
Organization-based multi-tenancy
RBAC (roles + permissions)
Document management
Notifications
Sandbox/admin tools

The system is organization-first, not just user-based.

2. Tech Stack
Next.js 16 (App Router)
React 19
TypeScript
Prisma 7 + PostgreSQL
NextAuth v5 (JWT strategy)
TailwindCSS
Stripe + PayPal
pdf-lib + xlsx
3. Core Architecture
Structure
/app → routes, API handlers, layouts
/features → UI per module (IFTA, etc.)
/services → business logic (critical layer)
/lib → infra (auth, prisma, billing, guards)
/prisma → schema
Principle

👉 Routes are thin. Services contain logic.

4. Multi-Tenant Model
Every user belongs to an organization
Enforced via:
ensureUserOrganization(userId)
Organization is backed by CompanyProfile
Access is always scoped by organizationId
5. Auth & RBAC
Auth
NextAuth v5
Providers:
Credentials
Google
Session includes:
user.id
roles[]
permissions[]
RBAC Guards
Page: requirePermission("module:action")
API: requireApiPermission("module:action")

Admins bypass restrictions.

6. Module Entitlements (Billing)

Modules are gated via:

AppModule
SubscriptionPlan
PlanModule
OrganizationSubscription
SubscriptionGrant

Access flow:

Check module exists & active
Check billing enabled
Allow if:
free module
active subscription includes module
active grant exists

Otherwise → redirect to /settings?tab=billing

7. Prisma Domain Overview
Identity
User, Account, Session
Role, Permission
Organization
CompanyProfile (acts as tenant)
OrganizationMember
Billing
SubscriptionPlan
OrganizationSubscription
BillingCharge
Coupon
AppModule
Financial custody
PaymentMethod
AchSecureVault
AchAuthorization
FinancialAccessAudit
Documents & notifications
Document
Notification
8. IFTA System (IMPORTANT)

There are two systems:

❗ Legacy (DO NOT TOUCH unless explicitly required)
IftaReport
Trip
FuelPurchase
✅ Active system (IFTA v2 / automation)
IftaFiling
RawIftaTrip
RawFuelPurchase
IftaDistanceLine
IftaFuelLine
IftaJurisdictionSummary
IftaQuarterSnapshot
IftaException
IftaAuditLog

👉 Codex should default to IFTA v2 only

9. IFTA v2 Flow
Trucker
Create/open filing
Sync/import data
Add manual fuel
Submit
Staff
Review queue
Start review
Request changes OR approve
Create snapshot
Final approval
10. IFTA Endpoints
GET    /api/v1/features/ifta-v2/filings
POST   /api/v1/features/ifta-v2/filings
GET    /api/v1/features/ifta-v2/filings/[id]
PUT    /api/v1/features/ifta-v2/filings/[id]/manual-fuel
POST   /api/v1/features/ifta-v2/filings/[id]/submit
POST   /api/v1/features/ifta-v2/filings/[id]/start-review
GET    /api/v1/features/ifta-v2/filings/[id]/download
11. Key Services (Critical)
FilingWorkflowService

Handles:

manual fuel updates
submission
review
approval
reopen
audit logs
CanonicalNormalizationService

Handles:

rebuilding filing from raw data
syncing vehicles
generating distance + fuel lines
Shared helpers
validation
quarter logic
decimal handling
exception rules
12. Business Rules (DO NOT BREAK)
Every user must have an organization
Module access is org-based

Manual fuel uses:

sourceType = "MANUAL_ADJUSTMENT"
Approved filings are immutable
Approval requires:
no blocking exceptions
snapshot freeze
All actions must be auditable
13. Billing Engine
Handles Stripe + PayPal

Recurring billing via internal cron:

/api/v1/internal/cron/billing
Supports:
coupons
retries
past_due handling
subscription replacement
14. Risks / Technical Debt
1. Monolithic Prisma schema

Hard to maintain and reason about.

2. Legacy + new IFTA coexist

Confusing, easy to break.

3. Stale Prisma delegate checks

lib/prisma/shared.ts references outdated model names.

4. Non-standard params typing
params: Promise<{ id: string }>
5. Debug logs in RBAC

Potential sensitive output.

6. CompanyProfile used as organization

Blurs domain boundaries.

7. Inline workflow side-effects

Notifications + audits tightly coupled.

8. Custom billing engine

Higher operational risk than provider-native subscriptions.

15. Codex Rules (VERY IMPORTANT)

When modifying this repo:

Do NOT bypass service layer
Do NOT add business logic in routes
Use IFTA v2 models only
Preserve audit logs
Preserve entitlement checks
Avoid renaming Prisma models unless required
Do not extend broken patterns (like Promise params)
Prefer additive changes over refactors
16. Default Mental Model

Think of this system as:

👉 "Multi-tenant compliance OS for trucking companies"

Not just a web app.