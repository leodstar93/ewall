import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

export async function DELETE(
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

    // Get the permission
    const permission = await prisma.permission.findUnique({
      where: { id },
      include: { _count: { select: { roles: true } } },
    });

    if (!permission) {
      return Response.json({ error: "Permission not found" }, { status: 404 });
    }

    // Delete the permission
    await prisma.permission.delete({
      where: { id },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting permission:", error);
    return Response.json(
      { error: "Failed to delete permission" },
      { status: 500 }
    );
  }
}
