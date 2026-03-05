import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

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
    const { roleIds } = await request.json();

    if (!Array.isArray(roleIds)) {
      return Response.json({ error: "Invalid roleIds format" }, { status: 400 });
    }

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      return Response.json({ error: "Permission not found" }, { status: 404 });
    }

    // Remove current role assignments
    await prisma.rolePermission.deleteMany({
      where: { permissionId: id },
    });

    // Add new role assignments
    await prisma.rolePermission.createMany({
      data: roleIds.map((roleId) => ({
        roleId,
        permissionId: id,
      })),
    });

    // Return updated permission
    const updatedPermission = await prisma.permission.findUnique({
      where: { id },
      include: {
        roles: {
          select: {
            role: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { roles: true },
        },
      },
    });

    return Response.json(updatedPermission);
  } catch (error) {
    console.error("Error updating permission roles:", error);
    return Response.json(
      { error: "Failed to update permission roles" },
      { status: 500 }
    );
  }
}
