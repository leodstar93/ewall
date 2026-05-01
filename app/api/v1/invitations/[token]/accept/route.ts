import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { ensureDefaultSelfServiceRoles } from "@/lib/default-user-roles";
import { ensureUserOrganization } from "@/lib/services/organization.service";
import { ensureStaffDisplayNameForUser } from "@/lib/services/staff-display-name.service";

type AcceptBody = {
  // Account
  name: string;
  password: string;
  // Company info
  companyName?: string;
  legalName?: string;
  dotNumber?: string;
  mcNumber?: string;
  businessPhone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  trucksCount?: string | number;
  driversCount?: string | number;
};

function normalizeOptionalCount(value: unknown) {
  if (value == null || value === "") return null;

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100000) {
    return null;
  }

  return numeric;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Validate token
  const invitation = await prisma.userInvitation.findUnique({ where: { token } });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }
  if (invitation.status === "REVOKED") {
    return NextResponse.json({ error: "This invitation has been revoked." }, { status: 410 });
  }
  if (invitation.status === "ACCEPTED") {
    return NextResponse.json({ error: "This invitation has already been used." }, { status: 410 });
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
  }

  let body: AcceptBody;
  try {
    body = (await request.json()) as AcceptBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!body.password || body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  // Check no user exists for this email yet (race-condition guard)
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const trucksCount = normalizeOptionalCount(body.trucksCount);
  const driversCount = normalizeOptionalCount(body.driversCount);

  // Resolve role names from invitation into role IDs
  const roleNames = Array.isArray(invitation.roleNames)
    ? (invitation.roleNames as string[])
    : [];
  const isStaffInvitation = roleNames.includes("STAFF");

  const roles =
    roleNames.length > 0
      ? await prisma.role.findMany({
          where: { name: { in: roleNames } },
          select: { id: true },
        })
      : [];

  // Create user + company profile in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: invitation.email,
        name: body.name.trim(),
        passwordHash,
      },
    });

    // Assign roles
    if (roles.length > 0) {
      await tx.userRole.createMany({
        data: roles.map((r) => ({ userId: created.id, roleId: r.id })),
      });
      await ensureStaffDisplayNameForUser(created.id, tx);
    }

    if (!isStaffInvitation) {
      // Upsert company profile
      await tx.companyProfile.upsert({
        where: { userId: created.id },
        update: {
          companyName: body.companyName?.trim() || null,
          legalName: body.legalName?.trim() || null,
          dotNumber: body.dotNumber?.trim() || null,
          mcNumber: body.mcNumber?.trim() || null,
          businessPhone: body.businessPhone?.trim() || null,
          addressLine1: body.addressLine1?.trim() || null,
          city: body.city?.trim() || null,
          state: body.state?.trim() || null,
          zipCode: body.zipCode?.trim() || null,
          trucksCount,
          driversCount,
        },
        create: {
          userId: created.id,
          companyName: body.companyName?.trim() || null,
          legalName: body.legalName?.trim() || null,
          dotNumber: body.dotNumber?.trim() || null,
          mcNumber: body.mcNumber?.trim() || null,
          businessPhone: body.businessPhone?.trim() || null,
          addressLine1: body.addressLine1?.trim() || null,
          city: body.city?.trim() || null,
          state: body.state?.trim() || null,
          zipCode: body.zipCode?.trim() || null,
          trucksCount,
          driversCount,
        },
      });
    }

    // Mark invitation as accepted
    await tx.userInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedByUserId: created.id,
      },
    });

    return created;
  });

  // Ensure default roles if none were assigned from invitation
  if (roles.length === 0) {
    await ensureDefaultSelfServiceRoles({ userId: user.id });
  }

  if (!isStaffInvitation) {
    // Ensure organization membership
    await ensureUserOrganization(user.id);
  }

  return NextResponse.json({ userId: user.id }, { status: 201 });
}
