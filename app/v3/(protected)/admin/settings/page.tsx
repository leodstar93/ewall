import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Quarter, FuelType } from '@prisma/client'
import { AdminSettingsPage } from './settings'
import type {
  IftaRateRow, UcrBracketRow, F2290RateRow,
  DmvFeeRow, JurisdictionRow, RoleRow, NewsRow, EmailTemplateRow,
} from './settings'

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function currentQuarterEnum(): Quarter {
  const m = new Date().getMonth() + 1
  if (m <= 3) return Quarter.Q1
  if (m <= 6) return Quarter.Q2
  if (m <= 9) return Quarter.Q3
  return Quarter.Q4
}

function fmtBracketLabel(min: number, max: number): string {
  if (max >= 99999) return `${min.toLocaleString()}+ vehicles`
  return `${min.toLocaleString()} – ${max.toLocaleString()} vehicles`
}

function deriveNewsStatus(isActive: boolean, activeFrom: Date | null, activeTo: Date | null): 'Published' | 'Scheduled' | 'Inactive' {
  const now = new Date()
  if (!isActive) return 'Inactive'
  if (activeFrom && activeFrom > now) return 'Scheduled'
  if (activeTo && activeTo < now) return 'Inactive'
  return 'Published'
}

export default async function AdminSettingsServerPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const currentYear = new Date().getFullYear()
  const currentQ = currentQuarterEnum()

  const [
    iftaRates,
    lastImportRun,
    ucrBrackets,
    ucrSetting,
    form2290Period,
    jurisdictions,
    roles,
    newsPosts,
    emailTemplates,
    dmvFeeRules,
  ] = await Promise.all([
    prisma.iftaTaxRate.findMany({
      where: { year: currentYear, quarter: currentQ },
      include: { jurisdiction: { select: { code: true } } },
      orderBy: { jurisdiction: { code: 'asc' } },
    }),
    prisma.iftaTaxRateImportRun.findFirst({
      where: { year: currentYear, quarter: currentQ },
      orderBy: { executedAt: 'desc' },
    }),
    prisma.uCRRateBracket.findMany({
      where: { active: true, year: currentYear },
      orderBy: { minVehicles: 'asc' },
    }),
    prisma.uCRAdminSetting.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.form2290TaxPeriod.findFirst({
      where: { startDate: { lte: new Date() } },
      orderBy: { startDate: 'desc' },
      include: { rates: { orderBy: { weightMin: 'asc' } } },
    }),
    prisma.jurisdiction.findMany({
      where: { isIftaMember: true },
      orderBy: { code: 'asc' },
      select: { code: true, isActive: true },
    }),
    prisma.role.findMany({
      include: { _count: { select: { users: true, permissions: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.newsUpdate.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.dmvFeeRule.findMany({
      where: { active: true, jurisdictionCode: { not: null } },
      orderBy: { jurisdictionCode: 'asc' },
    }),
  ])

  // Group IFTA rates by jurisdiction code
  const ratesByState = new Map<string, { diesel: number | null; gasoline: number | null; effectiveFrom: string | null }>()
  for (const r of iftaRates) {
    const code = r.jurisdiction.code
    const existing = ratesByState.get(code) ?? { diesel: null, gasoline: null, effectiveFrom: null }
    if (r.fuelType === FuelType.DI) existing.diesel = Number(r.taxRate)
    if (r.fuelType === FuelType.GA) existing.gasoline = Number(r.taxRate)
    if (r.effectiveFrom && !existing.effectiveFrom) existing.effectiveFrom = fmtDate(r.effectiveFrom)
    ratesByState.set(code, existing)
  }
  const iftaRateRows: IftaRateRow[] = [...ratesByState.entries()].map(([state, v]) => ({ state, ...v }))

  const ucrBracketRows: UcrBracketRow[] = ucrBrackets.map(b => ({
    id: b.id,
    label: fmtBracketLabel(b.minVehicles, b.maxVehicles),
    fee: Math.round(Number(b.feeAmount)),
  }))

  const f2290RateRows: F2290RateRow[] = (form2290Period?.rates ?? []).map(r => ({
    id: r.id,
    category: r.category,
    weightMin: r.weightMin,
    weightMax: r.weightMax ?? null,
    annualTax: Math.round(r.annualCents / 100),
  }))

  const dmvFeeRows: DmvFeeRow[] = dmvFeeRules
    .filter(r => r.jurisdictionCode !== null)
    .map(r => ({
      id: r.id,
      jurisdictionCode: r.jurisdictionCode!,
      amount: Math.round(Number(r.amount)),
      registrationType: r.registrationType ?? null,
    }))

  const jurisdictionRows: JurisdictionRow[] = jurisdictions.map(j => ({
    code: j.code,
    isActive: j.isActive,
  }))

  const roleRows: RoleRow[] = roles.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    userCount: r._count.users,
    permissionCount: r._count.permissions,
  }))

  const newsRows: NewsRow[] = newsPosts.map(n => ({
    id: n.id,
    title: n.title,
    eyebrow: n.eyebrow,
    audience: n.audience,
    status: deriveNewsStatus(n.isActive, n.activeFrom, n.activeTo),
    activeFrom: n.activeFrom ? fmtDate(n.activeFrom) : null,
    activeTo: n.activeTo ? fmtDate(n.activeTo) : null,
  }))

  const emailTemplateRows: EmailTemplateRow[] = emailTemplates.map(t => ({
    id: t.id,
    key: t.key,
    name: t.name,
    subject: t.subject,
    isActive: t.isActive,
    updatedAt: fmtDate(t.updatedAt),
  }))

  return (
    <AdminSettingsPage
      iftaRates={iftaRateRows}
      iftaLastSync={lastImportRun ? fmtDate(lastImportRun.executedAt) : null}
      iftaCurrentQuarter={`${currentYear} ${currentQ}`}
      ucrBrackets={ucrBracketRows}
      ucrActiveYear={ucrSetting?.activeYear ?? currentYear}
      f2290Rates={f2290RateRows}
      f2290PeriodName={form2290Period?.name ?? '—'}
      dmvFees={dmvFeeRows}
      jurisdictions={jurisdictionRows}
      roles={roleRows}
      newsPosts={newsRows}
      emailTemplates={emailTemplateRows}
    />
  )
}
