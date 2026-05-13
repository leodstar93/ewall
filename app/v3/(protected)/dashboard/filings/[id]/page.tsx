import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { IftaFilingDetail } from './detail'

export default async function IftaFilingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const { id } = await params
  const userId = session.user.id
  const org = await ensureUserOrganization(userId)

  const [filing, disclosureSetting] = await Promise.all([
    prisma.iftaFiling.findUnique({
    where: { id, tenantId: org.id },
    select: {
      id: true,
      year: true,
      quarter: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      totalDistance: true,
      totalFuelGallons: true,
      totalNetTax: true,
      totalTaxDue: true,
      notesClientVisible: true,
      updatedAt: true,
      fleetMpg: true,
      authorization: {
        select: { status: true, signerName: true, signerTitle: true, signedAt: true },
      },
      jurisdictionSummaries: {
        orderBy: { netTax: 'desc' },
        select: {
          id: true,
          jurisdiction: true,
          totalMiles: true,
          taxableGallons: true,
          taxPaidGallons: true,
          taxRate: true,
          taxDue: true,
          taxCredit: true,
          netTax: true,
        },
      },
      audits: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, action: true, message: true, createdAt: true },
      },
    },
  }),
    prisma.iftaAdminSetting.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { disclosureText: true },
    }),
  ])

  if (!filing) notFound()

  const documents = await prisma.document.findMany({
    where: { category: { startsWith: `ifta-v2-filing:${id}:` } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, fileName: true, fileUrl: true, fileType: true, fileSize: true, createdAt: true },
  })

  return (
    <IftaFilingDetail
      filing={{
        id: filing.id,
        year: filing.year,
        quarter: filing.quarter,
        status: filing.status,
        periodStart: filing.periodStart?.toISOString() ?? null,
        periodEnd: filing.periodEnd?.toISOString() ?? null,
        totalDistance: filing.totalDistance ? Number(filing.totalDistance) : null,
        totalFuelGallons: filing.totalFuelGallons ? Number(filing.totalFuelGallons) : null,
        totalNetTax: filing.totalNetTax ? Number(filing.totalNetTax) : null,
        totalTaxDue: filing.totalTaxDue ? Number(filing.totalTaxDue) : null,
        fleetMpg: filing.fleetMpg ? Number(filing.fleetMpg) : null,
        notesClientVisible: filing.notesClientVisible ?? null,
        updatedAt: filing.updatedAt.toISOString(),
        authorization: filing.authorization ? {
          status: filing.authorization.status,
          signerName: filing.authorization.signerName ?? null,
          signerTitle: filing.authorization.signerTitle ?? null,
          signedAt: filing.authorization.signedAt?.toISOString() ?? null,
        } : null,
        jurisdictions: filing.jurisdictionSummaries.map(j => ({
          id: j.id,
          jurisdiction: j.jurisdiction,
          totalMiles: Number(j.totalMiles),
          taxableGallons: Number(j.taxableGallons),
          taxPaidGallons: Number(j.taxPaidGallons),
          taxRate: Number(j.taxRate),
          taxDue: Number(j.taxDue),
          taxCredit: Number(j.taxCredit),
          netTax: Number(j.netTax),
        })),
        audits: filing.audits.map(a => ({
          id: a.id,
          action: a.action,
          message: a.message ?? null,
          createdAt: a.createdAt.toISOString(),
        })),
      }}
      disclosureText={disclosureSetting?.disclosureText ?? null}
      documents={documents.map(d => ({
        id: d.id,
        name: d.name,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        fileType: d.fileType,
        fileSize: d.fileSize,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  )
}
