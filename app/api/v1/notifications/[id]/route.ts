import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { markNotificationRead } from "@/services/notifications";

type NotificationPatchBody = {
  read?: unknown;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as NotificationPatchBody;

    if (typeof body.read !== "boolean") {
      return Response.json({ error: "Invalid read value" }, { status: 400 });
    }

    const notification = await markNotificationRead({
      notificationId: id,
      userId,
      read: body.read,
    });

    if (!notification) {
      return Response.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }

    return Response.json({ notification });
  } catch (error) {
    console.error("Failed to update notification", error);
    return Response.json(
      { error: "Failed to update notification" },
      { status: 500 },
    );
  }
}
