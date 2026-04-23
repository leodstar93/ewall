import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

// GET user's linked accounts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    
    const { id } = await params;

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Users can only see their own accounts.
  const isOwnAccount = session.user.id === id;

  if (!isOwnAccount) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const accounts = await prisma.account.findMany({
      where: { userId: id },
      select: {
        provider: true,
        providerAccountId: true,
      },
    });

    return Response.json({ accounts });
  } catch (error) {
    console.error("Error fetching user accounts:", error);
    return Response.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
