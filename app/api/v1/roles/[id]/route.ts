import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  // Check if user is authenticated and admin
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: {
              select: { id: true, key: true, description: true },
            },
          },
        },
        users: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!role) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }

    // Format response to match expected structure
    return Response.json({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((rp) => rp.permission),
      users: role.users.map((ur) => ur.user),
    });
  } catch (error) {
    console.error("Error fetching role:", error);
    return Response.json({ error: "Failed to fetch role" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();

  // Check if user is authenticated and admin
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = params;
    const { description } = await request.json();

    const role = await prisma.role.update({
      where: { id },
      data: {
        description: description || null,
      },
      include: {
        permissions: {
          include: {
            permission: {
              select: { id: true, key: true, description: true },
            },
          },
        },
        users: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    return Response.json({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((rp) => rp.permission),
      users: role.users.map((ur) => ur.user),
    });
  } catch (error) {
    console.error("Error updating role:", error);
    return Response.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  // Check if user is authenticated and admin
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = params;

    // Get the role
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }

    // Prevent deleting ADMIN role
    if (role.name === "ADMIN") {
      return Response.json(
        { error: "Cannot delete ADMIN role" },
        { status: 400 }
      );
    }

    // Prevent deleting roles with assigned users
    if (role._count.users > 0) {
      return Response.json(
        {
          error: `Cannot delete role with ${role._count.users} assigned user(s). Remove the role from all users first.`,
        },
        { status: 400 }
      );
    }

    // Delete the role
    await prisma.role.delete({
      where: { id },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return Response.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
