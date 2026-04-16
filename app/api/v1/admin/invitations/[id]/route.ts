import { NextResponse } from "next/server";
import { getAuthz } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

// ─── DELETE — revoke invitation ───────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, roles } = await getAuthz();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roles.includes("ADMIN")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  const invitation = await prisma.userInvitation.findUnique({ where: { id } });
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }

  if (invitation.status !== "PENDING") {
    return NextResponse.json({ error: "Only PENDING invitations can be revoked." }, { status: 400 });
  }

  const updated = await prisma.userInvitation.update({
    where: { id },
    data: { status: "REVOKED" },
  });

  return NextResponse.json({ invitation: updated });
}
