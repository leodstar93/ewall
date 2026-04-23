import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

// DELETE linked account by provider
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; provider: string }> }
) {
    const session = await auth();
    
    const { id, provider } = await params;

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Users can only unlink their own accounts.
  const isOwnAccount = session.user.id === id;

  if (!isOwnAccount) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Find and delete the account
    const deletedAccount = await prisma.account.deleteMany({
      where: {
        userId: id,
        provider: provider,
      },
    });

    if (deletedAccount.count === 0) {
      return Response.json(
        { error: "Linked account not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: `${provider} account unlinked successfully`,
    });
  } catch (error) {
    console.error("Error unlinking account:", error);
    return Response.json(
      { error: "Failed to unlink account" },
      { status: 500 }
    );
  }
}
