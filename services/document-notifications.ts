import { NotificationCategory, NotificationLevel } from "@prisma/client";
import { createNotification } from "@/services/notifications";

async function safeCreateNotification(
  input: Parameters<typeof createNotification>[0],
) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create document notification", error);
  }
}

export async function notifyDocumentRemoved(input: {
  userId: string;
  documentId: string;
  documentName: string;
  removedByRole: "ADMIN" | "STAFF";
}) {
  await safeCreateNotification({
    userId: input.userId,
    category: NotificationCategory.DOCUMENTS,
    level: NotificationLevel.WARNING,
    title: "A document was removed",
    message: `${input.documentName} was removed by ${input.removedByRole.toLowerCase()}. If you still need it for a filing, upload a replacement document.`,
    href: "/documents",
    actionLabel: "Open documents",
    metadataJson: {
      documentId: input.documentId,
      documentName: input.documentName,
      removedByRole: input.removedByRole,
    },
  });
}
