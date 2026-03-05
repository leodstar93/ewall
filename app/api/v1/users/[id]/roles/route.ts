import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

    try {
    const { id } = params;
    if (!id) {
      return Response.json({ error: "Missing user id" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ roles: user.roles.map((r) => r.role) });
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return Response.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params:  Promise<{id: string }> }
) {
    
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
      console.log("Fetching user roles for user id:", id);
      
    if (!id) {
      return Response.json({ error: "Missing user id" }, { status: 400 });
    }

    const { roleIds } = await request.json();

    if (!Array.isArray(roleIds)) {
      return Response.json({ error: "Invalid roleIds format" }, { status: 400 });
    }

    // ensure user exists
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // remove existing roles
    await prisma.userRole.deleteMany({ where: { userId: id } });

    if (roleIds.length) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
      });
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    return Response.json(updated);
  } catch (error) {
    console.error("Error updating user roles via separate endpoint:", error);
    return Response.json({ error: "Failed to update roles" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = params;
    if (!id) {
      return Response.json({ error: "Missing user id" }, { status: 400 });
    }

    // remove all roles
    await prisma.userRole.deleteMany({ where: { userId: id } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error clearing user roles:", error);
    return Response.json({ error: "Failed to clear roles" }, { status: 500 });
  }
}
