import { prisma } from "@/lib/prisma";
import { SettingsValidationError } from "@/lib/services/settings-errors";

function deriveOrganizationName(input: {
  name: string | null;
  email: string | null;
  companyProfile:
    | {
        name: string | null;
        legalName: string | null;
        dbaName: string | null;
        companyName: string | null;
      }
    | null;
}) {
  return (
    input.companyProfile?.name?.trim() ||
    input.companyProfile?.legalName?.trim() ||
    input.companyProfile?.dbaName?.trim() ||
    input.companyProfile?.companyName?.trim() ||
    input.name?.trim() ||
    input.email?.split("@")[0] ||
    "Default Company"
  );
}

async function syncUserOrganizationArtifacts(userId: string, organizationId: string) {
  await prisma.paymentMethod.updateMany({
    where: {
      userId,
      organizationId: null,
    },
    data: { organizationId },
  });
}

export async function ensureUserOrganization(userId: string) {
  const existingMembership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          legalName: true,
          dbaName: true,
          companyName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (existingMembership?.organization) {
    await syncUserOrganizationArtifacts(userId, existingMembership.organization.id);
    return {
      id: existingMembership.organization.id,
      name: deriveOrganizationName({
        name: null,
        email: null,
        companyProfile: existingMembership.organization,
      }),
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
          name: true,
          legalName: true,
          dbaName: true,
          companyName: true,
        },
      },
    },
  });

  if (!user) {
    throw new SettingsValidationError("User not found.");
  }

  const organization =
    user.companyProfile ??
    (await prisma.companyProfile.create({
      data: {
        userId,
        name: deriveOrganizationName(user),
        companyName: deriveOrganizationName(user),
      },
      select: {
        id: true,
        name: true,
        legalName: true,
        dbaName: true,
        companyName: true,
      },
    }));

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
    name: deriveOrganizationName(user),
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
          id: true,
          name: true,
          legalName: true,
          dbaName: true,
          companyName: true,
        },
      },
    },
  });

  return {
    organizationId: organization.id,
    organizationName: deriveOrganizationName({
      name: null,
      email: null,
      companyProfile: membership?.organization ?? null,
    }) || organization.name,
    membershipRole: membership?.role ?? organization.role,
  };
}
