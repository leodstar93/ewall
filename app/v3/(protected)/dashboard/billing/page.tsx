import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { ClientBillingPage } from './billing'

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function chargeDesc(start: Date | null, end: Date | null): string {
  if (!start || !end) return 'Service charge'
  const s = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const e = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return s === e ? `Service · ${s}` : `Service · ${s} – ${e}`
}

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id
  const org = await ensureUserOrganization(userId)

  const [subscription, charges] = await Promise.all([
    prisma.organizationSubscription.findFirst({
      where: { organizationId: org.id, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        plan: { select: { name: true, priceCents: true, interval: true } },
        paymentMethod: {
          select: { type: true, brand: true, last4: true, expMonth: true, expYear: true, holderName: true, paypalEmail: true, bankName: true },
        },
      },
    }),
    prisma.billingCharge.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, amountCents: true, status: true, billedForStart: true, billedForEnd: true, createdAt: true },
    }),
  ])

  const plan = subscription?.plan
    ? {
        name: subscription.plan.name,
        priceDollars: Math.round(subscription.plan.priceCents / 100),
        interval: subscription.plan.interval === 'YEAR' ? 'year' : 'month',
        status: subscription.status,
        nextChargeDate: subscription.currentPeriodEnd ? fmtDate(subscription.currentPeriodEnd) : null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      }
    : null

  const pm = subscription?.paymentMethod
    ? {
        type: subscription.paymentMethod.type,
        brand: subscription.paymentMethod.brand ?? null,
        last4: subscription.paymentMethod.last4 ?? null,
        expMonth: subscription.paymentMethod.expMonth ?? null,
        expYear: subscription.paymentMethod.expYear ?? null,
        holderName: subscription.paymentMethod.holderName ?? null,
        paypalEmail: subscription.paymentMethod.paypalEmail ?? null,
        bankName: subscription.paymentMethod.bankName ?? null,
      }
    : null

  const invoiceRows = charges.map(c => ({
    id: c.id,
    date: fmtDate(c.createdAt),
    desc: chargeDesc(c.billedForStart, c.billedForEnd),
    amount: Math.round(c.amountCents / 100),
    status: c.status,
  }))

  return (
    <ClientBillingPage
      plan={plan}
      paymentMethod={pm}
      invoiceRows={invoiceRows}
      stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      paypalConfigured={Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim())}
    />
  )
}
