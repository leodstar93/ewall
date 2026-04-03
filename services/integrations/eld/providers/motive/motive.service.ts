import { createHmac, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptEldSecret, encryptEldSecret } from "../../core/encryption";
import type { EldSyncRange } from "../../core/types";
import { buildDefaultSyncRange } from "../../core/utils";
import { MotiveClient } from "./motive.client";

const MOTIVE_PROVIDER = "MOTIVE";
const MOTIVE_AUTHORIZE_URL =
  process.env.MOTIVE_OAUTH_AUTHORIZE_URL?.trim() ?? "https://gomotive.com/oauth/authorize";
const MOTIVE_TOKEN_URL =
  process.env.MOTIVE_OAUTH_TOKEN_URL?.trim() ?? "https://gomotive.com/oauth/token";
const DEFAULT_SCOPES = [
  "companies.read",
  "users.read",
  "vehicles.read",
  "fuel_purchases.read",
  "ifta.read",
].join(" ");

type MotiveStatePayload = {
  carrierId: string;
  actorUserId: string;
  returnPath: string;
  nonce: string;
  issuedAt: string;
};

const DEFAULT_MOTIVE_RETURN_PATH = "/dashboard/ifta-v2";

function getOAuthConfig() {
  return {
    clientId: process.env.MOTIVE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.MOTIVE_CLIENT_SECRET?.trim() ?? "",
    redirectUri:
      process.env.MOTIVE_REDIRECT_URI?.trim() ??
      process.env.NEXT_PUBLIC_MOTIVE_REDIRECT_URI?.trim() ??
      "",
    scopes: process.env.MOTIVE_OAUTH_SCOPES?.trim() ?? DEFAULT_SCOPES,
  };
}

function getStateSecret() {
  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  if (!secret) {
    throw new Error("AUTH_SECRET is required to sign Motive state.");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signState(payload: string) {
  return createHmac("sha256", getStateSecret()).update(payload, "utf8").digest("base64url");
}

function normalizeReturnPath(value?: string | null) {
  const path = value?.trim();

  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_MOTIVE_RETURN_PATH;
  }

  return path;
}

function encodeState(payload: MotiveStatePayload) {
  const serialized = JSON.stringify(payload);
  const signature = signState(serialized);
  return base64UrlEncode(JSON.stringify({ payload: serialized, signature }));
}

export function decodeMotiveState(value: string) {
  const decoded = JSON.parse(base64UrlDecode(value)) as {
    payload?: string;
    signature?: string;
  };

  if (typeof decoded.payload !== "string" || typeof decoded.signature !== "string") {
    throw new Error("Invalid Motive state payload.");
  }

  if (signState(decoded.payload) !== decoded.signature) {
    throw new Error("Invalid Motive state signature.");
  }

  const payload = JSON.parse(decoded.payload) as Partial<MotiveStatePayload>;

  if (
    typeof payload.carrierId !== "string" ||
    typeof payload.actorUserId !== "string" ||
    typeof payload.returnPath !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.issuedAt !== "string"
  ) {
    throw new Error("Invalid Motive state contents.");
  }

  return {
    ...payload,
    returnPath: normalizeReturnPath(payload.returnPath),
  } as MotiveStatePayload;
}

export function canUseMotiveOAuth() {
  const config = getOAuthConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

export function buildMotiveAuthorizationUrl(input: {
  carrierId: string;
  actorUserId: string;
  returnPath?: string | null;
}) {
  const config = getOAuthConfig();

  if (!config.clientId || !config.redirectUri) {
    throw new Error("Motive OAuth is not configured.");
  }

  const state = encodeState({
    carrierId: input.carrierId,
    actorUserId: input.actorUserId,
    returnPath: normalizeReturnPath(input.returnPath),
    nonce: randomUUID(),
    issuedAt: new Date().toISOString(),
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes,
    state,
  });

  return `${MOTIVE_AUTHORIZE_URL}?${params.toString()}`;
}

async function requestOAuthToken(body: URLSearchParams) {
  const response = await fetch(MOTIVE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok || !payload) {
    throw new Error(`Motive token exchange failed with status ${response.status}.`);
  }

  return payload;
}

async function readStoredRefreshToken(connectionId: string) {
  const connection = await prisma.eldConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      provider: true,
      refreshTokenEnc: true,
    },
  });

  if (!connection || connection.provider !== MOTIVE_PROVIDER) {
    throw new Error("Motive connection not found.");
  }

  return decryptEldSecret(connection.refreshTokenEnc);
}

export async function exchangeMotiveAuthorizationCode(code: string) {
  const config = getOAuthConfig();

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("Motive OAuth is not configured.");
  }

  return requestOAuthToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  );
}

export async function refreshMotiveAccessToken(connectionId: string) {
  const config = getOAuthConfig();

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("Motive OAuth refresh is not configured.");
  }

  const refreshToken = await readStoredRefreshToken(connectionId);
  if (!refreshToken) {
    throw new Error("No Motive refresh token is available for this connection.");
  }

  const payload = await requestOAuthToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  );

  const accessToken = String(payload.access_token ?? "").trim();
  if (!accessToken) {
    throw new Error("Motive OAuth refresh did not return an access token.");
  }

  const nextRefreshToken =
    typeof payload.refresh_token === "string" && payload.refresh_token.trim()
      ? payload.refresh_token.trim()
      : refreshToken;

  const updated = await upsertMotiveConnection({
    connectionId,
    accessToken,
    refreshToken: nextRefreshToken,
    externalCompanyId: MotiveClient.extractExternalCompanyId(payload),
    tokenExpiresAt: MotiveClient.extractTokenExpiry(payload.expires_in),
    status: "ACTIVE",
  });

  return updated;
}

export async function upsertMotiveConnection(input: {
  carrierId?: string;
  connectionId?: string;
  accessToken: string;
  refreshToken?: string | null;
  externalCompanyId?: string | null;
  tokenExpiresAt?: Date | null;
  status?: "ACTIVE" | "ERROR" | "DISCONNECTED";
}) {
  const accessToken = input.accessToken.trim();
  if (!accessToken) {
    throw new Error("Motive access token is required.");
  }

  const existing = input.connectionId
    ? await prisma.eldConnection.findUnique({
        where: { id: input.connectionId },
        select: {
          id: true,
          carrierId: true,
          provider: true,
          refreshTokenEnc: true,
        },
      })
    : input.carrierId
      ? await prisma.eldConnection.findUnique({
          where: {
            carrierId_provider: {
              carrierId: input.carrierId,
              provider: MOTIVE_PROVIDER,
            },
          },
          select: {
            id: true,
            carrierId: true,
            provider: true,
            refreshTokenEnc: true,
          },
        })
      : null;

  const carrierId = input.carrierId ?? existing?.carrierId;
  if (!carrierId) {
    throw new Error("Carrier ID is required to persist a Motive connection.");
  }

  const refreshTokenEnc =
    typeof input.refreshToken === "undefined"
      ? existing?.refreshTokenEnc ?? encryptEldSecret("")
      : encryptEldSecret(input.refreshToken?.trim() ?? "");

  if (existing) {
    return prisma.eldConnection.update({
      where: { id: existing.id },
      data: {
        status: input.status ?? "ACTIVE",
        externalCompanyId: input.externalCompanyId ?? undefined,
        accessTokenEnc: encryptEldSecret(accessToken),
        refreshTokenEnc,
        tokenExpiresAt: input.tokenExpiresAt ?? null,
        lastError: null,
      },
    });
  }

  return prisma.eldConnection.create({
    data: {
      carrierId,
      provider: MOTIVE_PROVIDER,
      status: input.status ?? "ACTIVE",
      externalCompanyId: input.externalCompanyId ?? null,
      accessTokenEnc: encryptEldSecret(accessToken),
      refreshTokenEnc,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
    },
  });
}

export async function getMotiveClientForConnection(connectionId: string) {
  const connection = await prisma.eldConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      carrierId: true,
      provider: true,
      status: true,
      accessTokenEnc: true,
      refreshTokenEnc: true,
      tokenExpiresAt: true,
      externalCompanyId: true,
      lastSyncAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!connection || connection.provider !== MOTIVE_PROVIDER) {
    throw new Error("Motive connection not found.");
  }

  let accessToken = decryptEldSecret(connection.accessTokenEnc);

  const shouldRefresh =
    connection.tokenExpiresAt instanceof Date &&
    connection.tokenExpiresAt.getTime() <= Date.now() + 2 * 60 * 1000 &&
    decryptEldSecret(connection.refreshTokenEnc).length > 0 &&
    canUseMotiveOAuth();

  if (shouldRefresh) {
    const refreshed = await refreshMotiveAccessToken(connection.id);
    accessToken = decryptEldSecret(refreshed.accessTokenEnc);
    return {
      connection: refreshed,
      client: new MotiveClient(accessToken),
    };
  }

  return {
    connection,
    client: new MotiveClient(accessToken),
  };
}

export async function listCarrierMotiveConnections(carrierId: string) {
  return prisma.eldConnection.findMany({
    where: {
      carrierId,
      provider: MOTIVE_PROVIDER,
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export function buildMotiveSyncRange(range?: Partial<EldSyncRange>) {
  if (range?.start && range?.end) {
    return {
      start: range.start,
      end: range.end,
      updatedAfter: range.updatedAfter,
    };
  }

  return buildDefaultSyncRange();
}
