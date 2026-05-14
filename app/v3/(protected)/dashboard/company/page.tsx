import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureUserOrganization } from '@/lib/services/organization.service'
import { CompanyPageClient } from './company'

export default async function CompanyPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const org     = await ensureUserOrganization(session.user.id)
  const company = await prisma.companyProfile.findUnique({
    where: { id: org.id },
    select: {
      legalName: true, dbaName: true,
      dotNumber: true, mcNumber: true, ein: true,
      phone: true, businessPhone: true,
      addressLine1: true, city: true, state: true, zipCode: true,
      saferPowerUnits: true, saferDrivers: true,
      saferOperatingStatus: true, saferEntityType: true,
    },
  })

  return (
    <CompanyPageClient
      company={{
        legalName:           company?.legalName           ?? null,
        dbaName:             company?.dbaName             ?? null,
        dotNumber:           company?.dotNumber           ?? null,
        mcNumber:            company?.mcNumber            ?? null,
        ein:                 company?.ein                 ?? null,
        phone:               company?.phone ?? company?.businessPhone ?? null,
        addressLine1:        company?.addressLine1        ?? null,
        city:                company?.city                ?? null,
        state:               company?.state               ?? null,
        zipCode:             company?.zipCode             ?? null,
        saferPowerUnits:     company?.saferPowerUnits     ?? null,
        saferDrivers:        company?.saferDrivers        ?? null,
        saferOperatingStatus: company?.saferOperatingStatus ?? null,
        saferEntityType:     company?.saferEntityType     ?? null,
      }}
    />
  )
}
