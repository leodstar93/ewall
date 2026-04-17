import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { ensureDefaultSelfServiceRoles } from "@/lib/default-user-roles";
import { ensureUserOrganization } from "@/lib/services/organization.service";

export async function GET() {
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: {
            select: { id: true, name: true },
          },
        },
      },
      companyProfile: {
        select: {
          legalName: true,
          companyName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(users);
}

export async function POST(request: Request) {
  try {
    const { email, name, password, roleIds } = await request.json();

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return Response.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
      },
      include: {
        roles: {
          include: {
            role: {
              select: { id: true, name: true },
            },
          },
        },
        companyProfile: {
          select: {
            legalName: true,
            companyName: true,
          },
        },
      },
    });

    // Assign explicit roles when provided; otherwise default client roles apply.
    if (roleIds && roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId: string) => ({
          userId: user.id,
          roleId,
        })),
      });
    } else {
      await ensureDefaultSelfServiceRoles({ userId: user.id });
    }

    await ensureUserOrganization(user.id);

    const userWithRoles = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: {
            role: {
              select: { id: true, name: true },
            },
          },
        },
        companyProfile: {
          select: {
            legalName: true,
            companyName: true,
          },
        },
      },
    });

    return Response.json(userWithRoles, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}
