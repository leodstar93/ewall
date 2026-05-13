import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { listNotificationsForUser, markNotificationRead, markAllNotificationsRead } from "@/services/notifications";

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

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await request.json();

  if (body.all) {
    const result = await markAllNotificationsRead(userId);
    return Response.json(result);
  }

  if (body.id) {
    const result = await markNotificationRead({ notificationId: body.id, userId, read: true });
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(result);
  }

  return Response.json({ error: "Missing id or all" }, { status: 400 });
}
