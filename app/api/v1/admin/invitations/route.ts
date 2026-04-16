import { NextResponse } from "next/server";
import { getAuthz } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email";

// ─── GET — list all invitations ───────────────────────────────────────────────

export async function GET() {
  const { session, roles } = await getAuthz();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roles.includes("ADMIN")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const invitations = await prisma.userInvitation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
      acceptedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ invitations });
}

// ─── POST — create invitation + send email ────────────────────────────────────

export async function POST(request: Request) {
  const { session, roles } = await getAuthz();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roles.includes("ADMIN")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string; roleNames?: string[]; note?: string };
  try {
    body = (await request.json()) as { email?: string; roleNames?: string[]; note?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  // Revoke any existing pending invitation for this email
  await prisma.userInvitation.updateMany({
    where: { email, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  const invitation = await prisma.userInvitation.create({
    data: {
      email,
      roleNames: body.roleNames ?? ["TRUCKER", "USER"],
      note: body.note?.trim() || null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedById: session.user.id,
    },
  });

  const baseUrl =
    (process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim() || "http://localhost:3000").replace(
      /\/+$/,
      "",
    );
  const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

  try {
    await sendInvitationEmail({
      to: email,
      inviteUrl,
      invitedByName: session.user.name,
      note: body.note,
    });
  } catch (err) {
    // Rollback the invitation if email fails
    await prisma.userInvitation.delete({ where: { id: invitation.id } });
    const message = err instanceof Error ? err.message : "Failed to send invitation email.";
    console.error("sendInvitationEmail failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ invitation }, { status: 201 });
}
