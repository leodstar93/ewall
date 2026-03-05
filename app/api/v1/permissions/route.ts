import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await auth();

  // Check if user is authenticated and admin
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const permissions = await prisma.permission.findMany({
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
      orderBy: { key: "asc" },
    });

    return Response.json(permissions);
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return Response.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  // Check if user is authenticated and admin
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { key, description } = await request.json();

    if (!key || !key.trim()) {
      return Response.json(
        { error: "Permission key is required" },
        { status: 400 }
      );
    }

    // Check if permission already exists
    const existingPermission = await prisma.permission.findUnique({
      where: { key: key.toLowerCase() },
    });

    if (existingPermission) {
      return Response.json(
        { error: "Permission already exists" },
        { status: 400 }
      );
    }

    const permission = await prisma.permission.create({
      data: {
        key: key.toLowerCase(),
        description: description || null,
      },
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

    return Response.json(permission, { status: 201 });
  } catch (error) {
    console.error("Error creating permission:", error);
    return Response.json(
      { error: "Failed to create permission" },
      { status: 500 }
    );
  }
}
