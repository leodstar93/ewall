import { prisma } from "@/lib/prisma";
import { SettingsValidationError } from "@/lib/services/settings-errors";

function deriveOrganizationName(user: {
  name: string | null;
  email: string | null;
  companyProfile: { legalName: string | null; dbaName: string | null } | null;
}) {
  return (
    user.companyProfile?.legalName ??
    user.companyProfile?.dbaName ??
    user.name ??
    user.email?.split("@")[0] ??
    "Default Organization"
  );
}

async function syncUserOrganizationArtifacts(userId: string, organizationId: string) {
  await prisma.$transaction([
    prisma.companyProfile.updateMany({
      where: {
        userId,
        organizationId: null,
      },
      data: { organizationId },
    }),
    prisma.paymentMethod.updateMany({
      where: {
        userId,
        organizationId: null,
      },
      data: { organizationId },
    }),
  ]);
}

export async function ensureUserOrganization(userId: string) {
  const existingMembership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (existingMembership?.organization) {
    await syncUserOrganizationArtifacts(userId, existingMembership.organization.id);
    return {
      id: existingMembership.organization.id,
      name: existingMembership.organization.name,
      role: existingMembership.role,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      companyProfile: {
        select: {
          id: true,
          organizationId: true,
          legalName: true,
          dbaName: true,
        },
      },
    },
  });

  if (!user) {
    throw new SettingsValidationError("User not found.");
  }

  const organizationId = user.companyProfile?.organizationId ?? null;

  const organization = organizationId
    ? await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      })
    : await prisma.organization.create({
        data: { name: deriveOrganizationName(user) },
        select: { id: true, name: true },
      });

  if (!organization) {
    throw new SettingsValidationError("Could not resolve organization.");
  }

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId,
      },
    },
    update: { role: "OWNER" },
    create: {
      organizationId: organization.id,
      userId,
      role: "OWNER",
    },
  });

  await syncUserOrganizationArtifacts(userId, organization.id);

  return {
    id: organization.id,
    name: organization.name,
    role: "OWNER",
  };
}

export async function getUserOrganizationId(userId: string) {
  const organization = await ensureUserOrganization(userId);
  return organization.id;
}

export async function getUserOrganizationContext(userId: string) {
  const organization = await ensureUserOrganization(userId);

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId: organization.id,
    },
    select: {
      id: true,
      role: true,
      organizationId: true,
      organization: {
        select: {
          name: true,
        },
      },
    },
  });

  return {
    organizationId: organization.id,
    organizationName: membership?.organization.name ?? organization.name,
    membershipRole: membership?.role ?? organization.role,
  };
}
