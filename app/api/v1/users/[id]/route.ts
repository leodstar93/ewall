import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

// DELETE user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  // Check admin access
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = params;

    // Don't allow deleting the last admin
    const adminRole = await prisma.role.findUnique({
      where: { name: "ADMIN" },
      include: { users: true },
    });

    const userRoles = await prisma.userRole.findMany({
      where: { userId: id, role: { name: "ADMIN" } },
    });

    if (
      userRoles.length > 0 &&
      adminRole &&
      adminRole.users.length === 1
    ) {
      return Response.json(
        { error: "Cannot delete the last admin user" },
        { status: 400 }
      );
    }

    // Delete user and cascade relations
    await prisma.user.delete({
      where: { id },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return Response.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

// fetch single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    return Response.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return Response.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

// UPDATE user roles
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  // Check admin access
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = params;
    const { roleIds } = await request.json();

    if (!Array.isArray(roleIds)) {
      return Response.json(
        { error: "Invalid roleIds format" },
        { status: 400 }
      );
    }

    // Remove current roles
    await prisma.userRole.deleteMany({
      where: { userId: id },
    });

    // Add new roles
    await prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId: id,
        roleId,
      })),
    });

    // Return updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    return Response.json(updatedUser);
  } catch (error) {
    console.error("Error updating user roles:", error);
    return Response.json(
      { error: "Failed to update user roles" },
      { status: 500 }
    );
  }
}
