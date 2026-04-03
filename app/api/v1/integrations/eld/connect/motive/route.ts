import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { resolveCarrierIdForGuard } from "@/lib/ifta-v2-api";
import {
  buildMotiveAuthorizationUrl,
  canUseMotiveOAuth,
  listCarrierMotiveConnections,
  upsertMotiveConnection,
} from "@/services/integrations/eld/providers/motive/motive.service";

type ConnectBody = {
  carrierId?: unknown;
  accessToken?: unknown;
  refreshToken?: unknown;
  externalCompanyId?: unknown;
  tokenExpiresAt?: unknown;
};

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function buildResponse(
  carrierId: string,
  userId: string | null | undefined,
  returnPath?: string | null,
) {
  const connections = await listCarrierMotiveConnections(carrierId);

  let authorizationUrl: string | null = null;

  if (canUseMotiveOAuth() && userId) {
    authorizationUrl = buildMotiveAuthorizationUrl({
      carrierId,
      actorUserId: userId,
      returnPath,
    });
  }

  return Response.json({
    provider: "MOTIVE",
    carrierId,
    oauthEnabled: canUseMotiveOAuth(),
    authorizationUrl,
    connections,
  });
}

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("eld:connect");
  if (!guard.ok) return guard.res;

  try {
    const carrierId = await resolveCarrierIdForGuard(
      guard,
      request.nextUrl.searchParams.get("carrierId"),
    );
    return buildResponse(
      carrierId,
      guard.session.user.id ?? null,
      normalizeOptionalString(request.nextUrl.searchParams.get("returnPath")),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load Motive connection state" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("eld:connect");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as ConnectBody;
    const carrierId = await resolveCarrierIdForGuard(
      guard,
      normalizeOptionalString(body.carrierId),
    );

    const accessToken = normalizeOptionalString(body.accessToken);
    if (!accessToken) {
      return Response.json(
        {
          provider: "MOTIVE",
          carrierId,
          oauthEnabled: canUseMotiveOAuth(),
          authorizationUrl: canUseMotiveOAuth()
            ? buildMotiveAuthorizationUrl({
                carrierId,
                actorUserId: guard.session.user.id ?? "",
              })
            : null,
        },
        { status: 200 },
      );
    }

    const connection = await upsertMotiveConnection({
      carrierId,
      accessToken,
      refreshToken: normalizeOptionalString(body.refreshToken),
      externalCompanyId: normalizeOptionalString(body.externalCompanyId),
      tokenExpiresAt: parseOptionalDate(body.tokenExpiresAt),
      status: "ACTIVE",
    });

    return Response.json({ connection }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to connect Motive" },
      { status: 400 },
    );
  }
}
