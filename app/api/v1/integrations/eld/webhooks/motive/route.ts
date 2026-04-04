import { ELDProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ELDProviderRegistry } from "@/services/ifta-automation/adapters";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    const adapter = ELDProviderRegistry.getAdapter(ELDProvider.MOTIVE);
    const signatureValid = adapter.verifyWebhookSignature
      ? await adapter.verifyWebhookSignature({
          headers: request.headers,
          rawBody,
        })
      : null;

    const externalOrgId =
      typeof payload.org_id === "string"
        ? payload.org_id
        : typeof payload.external_org_id === "string"
          ? payload.external_org_id
          : null;
    const integrationAccount = externalOrgId
      ? await prisma.integrationAccount.findFirst({
          where: {
            provider: ELDProvider.MOTIVE,
            externalOrgId,
          },
          select: { id: true },
        })
      : null;

    const event = await prisma.integrationWebhookEvent.create({
      data: {
        integrationAccountId: integrationAccount?.id ?? null,
        provider: ELDProvider.MOTIVE,
        eventType:
          typeof payload.event_type === "string"
            ? payload.event_type
            : typeof payload.type === "string"
              ? payload.type
              : "unknown",
        externalEventId:
          typeof payload.id === "string"
            ? payload.id
            : typeof payload.event_id === "string"
              ? payload.event_id
              : null,
        signatureValid: typeof signatureValid === "boolean" ? signatureValid : null,
        payloadJson: JSON.parse(JSON.stringify(payload)),
      },
    });

    return Response.json(
      {
        accepted: true,
        signatureValid,
        webhookEventId: event.id,
      },
      { status: 202 },
    );
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to process Motive webhook.");
  }
}
