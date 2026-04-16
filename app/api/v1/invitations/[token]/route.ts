import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GET — validate token, return invitation info ─────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invitation = await prisma.userInvitation.findUnique({
    where: { token },
    include: { invitedBy: { select: { name: true } } },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }

  if (invitation.status === "REVOKED") {
    return NextResponse.json({ error: "This invitation has been revoked." }, { status: 410 });
  }

  if (invitation.status === "ACCEPTED") {
    return NextResponse.json({ error: "This invitation has already been used." }, { status: 410 });
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
  }

  return NextResponse.json({
    email: invitation.email,
    invitedByName: invitation.invitedBy.name,
    expiresAt: invitation.expiresAt,
  });
}
