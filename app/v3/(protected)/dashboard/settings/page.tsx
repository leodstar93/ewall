import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { ClientSettingsPage } from './settings'

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function chargeDesc(start: Date | null, end: Date | null): string {
  if (!start || !end) return 'Service charge'
  const s = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const e = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return s === e ? `Service · ${s}` : `Service · ${s} – ${e}`
}

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id
  const org = await ensureUserOrganization(userId)

  const [company, subscription, charges, integrations, truckCount, recentNotifications] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { id: org.id },
      select: {
        legalName: true, dbaName: true, companyName: true,
        dotNumber: true, mcNumber: true, ein: true,
        phone: true, businessPhone: true,
        addressLine1: true, addressLine2: true, city: true, state: true, zipCode: true,
        saferPowerUnits: true, saferDrivers: true,
        saferOperatingStatus: true, saferEntityType: true, saferLastFetchedAt: true,
        saferMcs150Mileage: true,
      },
    }),
    prisma.organizationSubscription.findFirst({
      where: { organizationId: org.id, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true,
        plan: { select: { name: true, priceCents: true, interval: true } },
        paymentMethod: {
          select: { type: true, brand: true, last4: true, expMonth: true, expYear: true, holderName: true, paypalEmail: true, bankName: true },
        },
      },
    }),
    prisma.billingCharge.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, amountCents: true, status: true, billedForStart: true, billedForEnd: true, createdAt: true },
    }),
    prisma.integrationAccount.findMany({
      where: { tenantId: org.id },
      select: { id: true, provider: true, status: true, lastSuccessfulSyncAt: true, externalOrgName: true },
    }),
    prisma.truck.count({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, message: true, level: true, category: true, createdAt: true },
    }),
  ])

  const companyData = {
    legalName: company?.legalName ?? null,
    dbaName: company?.dbaName ?? null,
    dotNumber: company?.dotNumber ?? null,
    mcNumber: company?.mcNumber ?? null,
    ein: company?.ein ?? null,
    phone: company?.phone ?? company?.businessPhone ?? null,
    addressLine1: company?.addressLine1 ?? null,
    city: company?.city ?? null,
    state: company?.state ?? null,
    zipCode: company?.zipCode ?? null,
    saferPowerUnits: company?.saferPowerUnits ?? null,
    saferDrivers: company?.saferDrivers ?? null,
    saferOperatingStatus: company?.saferOperatingStatus ?? null,
    saferEntityType: company?.saferEntityType ?? null,
  }

  const plan = subscription?.plan
    ? {
        name: subscription.plan.name,
        priceDollars: Math.round(subscription.plan.priceCents / 100),
        interval: subscription.plan.interval === 'YEAR' ? 'year' : 'month',
        status: subscription.status,
        nextChargeDate: subscription.currentPeriodEnd ? fmtDate(subscription.currentPeriodEnd) : null,
      }
    : null

  const pm = subscription?.paymentMethod ?? null

  const invoiceRows = charges.map(c => ({
    id: c.id,
    date: fmtDate(c.createdAt),
    desc: chargeDesc(c.billedForStart, c.billedForEnd),
    amount: Math.round(c.amountCents / 100),
    status: c.status,
  }))

  const integrationRows = integrations.map(i => ({
    id: i.id,
    provider: i.provider,
    status: i.status,
    orgName: i.externalOrgName ?? null,
    lastSyncedAt: i.lastSuccessfulSyncAt ? fmtDate(i.lastSuccessfulSyncAt) : null,
  }))

  const auditRows = recentNotifications.map(n => ({
    id: n.id,
    title: n.title,
    message: n.message,
    level: n.level,
    when: fmtDate(n.createdAt),
  }))

  return (
    <ClientSettingsPage
      userEmail={session.user.email ?? ''}
      userName={session.user.name ?? ''}
      company={companyData}
      plan={plan}
      paymentMethod={pm}
      invoiceRows={invoiceRows}
      truckCount={truckCount}
      integrationRows={integrationRows}
      auditRows={auditRows}
    />
  )
}
