import { auth } from "@/auth";
import { markAllNotificationsRead } from "@/services/notifications";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await markAllNotificationsRead(userId);
    return Response.json(result);
  } catch (error) {
    console.error("Failed to mark notifications as read", error);
    return Response.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 },
    );
  }
}
