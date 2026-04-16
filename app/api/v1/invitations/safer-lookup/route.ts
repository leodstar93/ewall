import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSaferByDot } from "@/lib/safer-lookup";

// Public SAFER lookup scoped to a valid invitation token.
// Requires a valid, non-expired PENDING token so it can't be abused openly.

export async function POST(request: Request) {
  let body: { dotNumber?: string; token?: string };
  try {
    body = (await request.json()) as { dotNumber?: string; token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Validate token before allowing the lookup
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  const invitation = await prisma.userInvitation.findUnique({
    where: { token },
    select: { status: true, expiresAt: true },
  });

  if (
    !invitation ||
    invitation.status !== "PENDING" ||
    invitation.expiresAt < new Date()
  ) {
    return NextResponse.json({ error: "Invalid or expired invitation." }, { status: 403 });
  }

  const rawDot = typeof body.dotNumber === "string" ? body.dotNumber.trim() : "";
  const dotNumber = rawDot.replace(/\D/g, "");

  if (!/^\d{5,8}$/.test(dotNumber)) {
    return NextResponse.json({ error: "Invalid USDOT number." }, { status: 400 });
  }

  try {
    const result = await fetchSaferByDot(dotNumber);
    return NextResponse.json(result, { status: result.found ? 200 : 404 });
  } catch {
    return NextResponse.json(
      { error: "We couldn't retrieve company data from SAFER right now." },
      { status: 502 },
    );
  }
}
