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
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          select: {
            permission: {
              select: { id: true, key: true },
            },
          },
        },
        _count: {
          select: { users: true, permissions: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return Response.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return Response.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  // Check if user is authenticated and admin
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return Response.json(
        { error: "Role name is required" },
        { status: 400 }
      );
    }

    // Check if role already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: name.toUpperCase() },
    });

    if (existingRole) {
      return Response.json(
        { error: "Role already exists" },
        { status: 400 }
      );
    }

    const role = await prisma.role.create({
      data: {
        name: name.toUpperCase(),
        description: description || null,
      },
      include: {
        _count: {
          select: { users: true, permissions: true },
        },
      },
    });

    return Response.json(role, { status: 201 });
  } catch (error) {
    console.error("Error creating role:", error);
    return Response.json({ error: "Failed to create role" }, { status: 500 });
  }
}
