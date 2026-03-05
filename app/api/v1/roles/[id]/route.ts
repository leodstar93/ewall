import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

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
