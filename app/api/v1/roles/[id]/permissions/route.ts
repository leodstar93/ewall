import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

// PUT - Update role permissions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  // Check if user is authenticated and admin
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { permissionIds } = await request.json();

    if (!Array.isArray(permissionIds)) {
      return Response.json(
        { error: "permissionIds must be an array" },
        { status: 400 }
      );
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }

    // Delete existing role-permission relationships
    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    // Create new role-permission relationships
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }

    // Return updated role
    const updatedRole = await prisma.role.findUnique({
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

    return Response.json({
      id: updatedRole!.id,
      name: updatedRole!.name,
      description: updatedRole!.description,
      permissions: updatedRole!.permissions.map((rp) => rp.permission),
      users: updatedRole!.users.map((ur) => ur.user),
    });
  } catch (error) {
    console.error("Error updating role permissions:", error);
    return Response.json(
      { error: "Failed to update role permissions" },
      { status: 500 }
    );
  }
}
