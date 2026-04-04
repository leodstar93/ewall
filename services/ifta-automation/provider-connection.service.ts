import { ELDProvider, IntegrationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureUserOrganization } from "@/lib/services/organization.service";
import {
  ELDProviderRegistry,
  type ELDProviderAdapter,
  type ProviderTokenSet,
} from "@/services/ifta-automation/adapters";
import {
  IftaAutomationError,
  type DbLike,
  resolveTenantContextForUser,
} from "@/services/ifta-automation/shared";
import {
  buildEldOauthState,
  decryptEldSecret,
  encryptEldSecret,
  verifyEldOauthState,
} from "@/services/ifta-automation/security";

function getRedirectBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();

  if (!baseUrl) {
    throw new IftaAutomationError(
      "App base URL is not configured. Set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL.",
      500,
      "APP_URL_NOT_CONFIGURED",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

function ensureConnectedStatus(status: IntegrationStatus) {
  if (status !== IntegrationStatus.CONNECTED && status !== IntegrationStatus.ERROR) {
    throw new IftaAutomationError(
      "The ELD provider is not connected for this tenant.",
      409,
      "ELD_NOT_CONNECTED",
    );
  }
}

export class ProviderConnectionService {
  static listProviders() {
    return [
      {
        provider: ELDProvider.MOTIVE,
        label: "Motive",
        status: "available",
        oauth: true,
        webhookSupported: true,
        notes: [
          "OAuth-first provider integration.",
          "TODO: Configure Motive scopes, credentials, and webhook secret in environment.",
        ],
      },
      {
        provider: ELDProvider.SAMSARA,
        label: "Samsara",
        status: "planned",
        oauth: true,
        webhookSupported: true,
        notes: [
          "Provider-agnostic backend is ready for a future SamsaraAdapter.",
        ],
      },
    ];
  }

  static async buildAuthorizationUrl(input: {
    userId: string;
    provider: ELDProvider;
    returnTo?: string | null;
    redirectUri?: string | null;
  }) {
    const tenant = await resolveTenantContextForUser(input.userId);
    const adapter = ELDProviderRegistry.getAdapter(input.provider);
    const redirectUri =
      input.redirectUri ||
      `${getRedirectBaseUrl()}/api/v1/integrations/eld/callback/${String(input.provider).toLowerCase()}`;
    const state = buildEldOauthState({
      provider: input.provider,
      tenantId: tenant.tenantId,
      userId: input.userId,
      returnTo: input.returnTo?.trim() || "/ifta-v2",
    });

    return {
      tenantId: tenant.tenantId,
      state,
      authorizationUrl: await adapter.buildAuthorizationUrl({
        tenantId: tenant.tenantId,
        userId: input.userId,
        redirectUri,
        state,
      }),
    };
  }

  static async persistTokenSet(input: {
    tenantId: string;
    provider: ELDProvider;
    tokenSet: ProviderTokenSet;
    metadataJson?: Prisma.InputJsonValue | null;
  }) {
    const now = new Date();
    const metadataJson = input.metadataJson
      ? JSON.parse(JSON.stringify(input.metadataJson))
      : undefined;
    return prisma.integrationAccount.upsert({
      where: {
        tenantId_provider: {
          tenantId: input.tenantId,
          provider: input.provider,
        },
      },
      update: {
        status: IntegrationStatus.CONNECTED,
        accessTokenEncrypted: encryptEldSecret(input.tokenSet.accessToken),
        refreshTokenEncrypted: input.tokenSet.refreshToken
          ? encryptEldSecret(input.tokenSet.refreshToken)
          : null,
        tokenExpiresAt: input.tokenSet.expiresAt,
        scopesJson: input.tokenSet.scopes,
        connectedAt: now,
        disconnectedAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        metadataJson,
      },
      create: {
        tenantId: input.tenantId,
        provider: input.provider,
        status: IntegrationStatus.CONNECTED,
        accessTokenEncrypted: encryptEldSecret(input.tokenSet.accessToken),
        refreshTokenEncrypted: input.tokenSet.refreshToken
          ? encryptEldSecret(input.tokenSet.refreshToken)
          : null,
        tokenExpiresAt: input.tokenSet.expiresAt,
        scopesJson: input.tokenSet.scopes,
        connectedAt: now,
        metadataJson,
      },
    });
  }

  static async handleOAuthCallback(input: {
    provider: ELDProvider;
    code: string;
    state: string;
    redirectUri?: string | null;
  }) {
    const payload = verifyEldOauthState(input.state);
    if (payload.provider !== input.provider) {
      throw new IftaAutomationError(
        "OAuth callback provider does not match state.",
        400,
        "OAUTH_PROVIDER_MISMATCH",
      );
    }

    const adapter = ELDProviderRegistry.getAdapter(input.provider);
    const redirectUri =
      input.redirectUri ||
      `${getRedirectBaseUrl()}/api/v1/integrations/eld/callback/${String(input.provider).toLowerCase()}`;
    const tokenSet = await adapter.exchangeCodeForToken({
      code: input.code,
      redirectUri,
    });

    const account = await this.persistTokenSet({
      tenantId: payload.tenantId,
      provider: input.provider,
      tokenSet,
      metadataJson: {
        oauthConnectedByUserId: payload.userId,
        oauthConnectedAt: new Date().toISOString(),
      },
    });

    return {
      state: payload,
      account,
      redirectTo: payload.returnTo || "/ifta-v2",
    };
  }

  static async disconnect(input: {
    userId: string;
    provider: ELDProvider;
  }) {
    const tenant = await ensureUserOrganization(input.userId);
    const account = await prisma.integrationAccount.findUnique({
      where: {
        tenantId_provider: {
          tenantId: tenant.id,
          provider: input.provider,
        },
      },
    });

    if (!account) {
      return null;
    }

    return prisma.integrationAccount.update({
      where: { id: account.id },
      data: {
        status: IntegrationStatus.DISCONNECTED,
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        tokenExpiresAt: null,
        disconnectedAt: new Date(),
      },
    });
  }

  static async getTenantConnectionStatus(input: {
    userId: string;
    provider?: ELDProvider | null;
  }) {
    const tenant = await ensureUserOrganization(input.userId);
    const where = input.provider
      ? {
          tenantId: tenant.id,
          provider: input.provider,
        }
      : {
          tenantId: tenant.id,
        };

    const accounts = await prisma.integrationAccount.findMany({
      where,
      include: {
        syncJobs: {
          orderBy: [{ createdAt: "desc" }],
          take: 5,
        },
      },
      orderBy: [{ provider: "asc" }],
    });

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      accounts,
    };
  }

  static async getAuthorizedIntegration(input: {
    tenantId: string;
    provider: ELDProvider;
    db?: DbLike;
  }) {
    const db = input.db ?? prisma;
    const account = await db.integrationAccount.findUnique({
      where: {
        tenantId_provider: {
          tenantId: input.tenantId,
          provider: input.provider,
        },
      },
    });

    if (!account) {
      throw new IftaAutomationError(
        "No ELD integration account is configured for this tenant.",
        404,
        "ELD_INTEGRATION_NOT_FOUND",
      );
    }

    ensureConnectedStatus(account.status);

    if (!account.accessTokenEncrypted) {
      throw new IftaAutomationError(
        "The ELD integration account is missing an access token.",
        409,
        "ELD_ACCESS_TOKEN_MISSING",
      );
    }

    const adapter = ELDProviderRegistry.getAdapter(account.provider);
    let accessToken = decryptEldSecret(account.accessTokenEncrypted);
    let refreshToken = account.refreshTokenEncrypted
      ? decryptEldSecret(account.refreshTokenEncrypted)
      : null;

    const shouldRefresh =
      Boolean(account.tokenExpiresAt) &&
      account.tokenExpiresAt!.getTime() <= Date.now() + 1000 * 60 &&
      Boolean(refreshToken);

    if (shouldRefresh && refreshToken) {
      try {
        const refreshed = await adapter.refreshAccessToken({ refreshToken });
        const updated = await this.persistTokenSet({
          tenantId: input.tenantId,
          provider: input.provider,
          tokenSet: refreshed,
          metadataJson: {
            ...(account.metadataJson && typeof account.metadataJson === "object" && !Array.isArray(account.metadataJson)
              ? (account.metadataJson as Record<string, unknown>)
              : {}),
            lastTokenRefreshAt: new Date().toISOString(),
          },
        });

        accessToken = decryptEldSecret(updated.accessTokenEncrypted ?? "");
        refreshToken = updated.refreshTokenEncrypted
          ? decryptEldSecret(updated.refreshTokenEncrypted)
          : null;
      } catch (error) {
        await db.integrationAccount.update({
          where: { id: account.id },
          data: {
            status: IntegrationStatus.ERROR,
            lastErrorAt: new Date(),
            lastErrorMessage:
              error instanceof Error ? error.message.slice(0, 1000) : "Token refresh failed.",
          },
        });
        throw error;
      }
    }

    return {
      adapter: adapter as ELDProviderAdapter,
      account,
      accessToken,
      refreshToken,
    };
  }
}
