import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { listNotificationsForUser } from "@/services/notifications";

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 8;
  const unreadOnly = searchParams.get("unread") === "true";

  try {
    const payload = await listNotificationsForUser({
      userId,
      limit,
      unreadOnly,
    });

    return Response.json(payload);
  } catch (error) {
    console.error("Failed to load notifications", error);
    return Response.json(
      { error: "Failed to load notifications" },
      { status: 500 },
    );
  }
}
