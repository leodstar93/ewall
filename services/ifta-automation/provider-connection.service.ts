import { ELDProvider, IntegrationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureUserOrganization } from "@/lib/services/organization.service";
import {
  ELDProviderRegistry,
  type ELDProviderAdapter,
  type ProviderOrganizationIdentity,
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
  static async findPreferredAccountForTenant(input: {
    tenantId: string;
    provider?: ELDProvider | null;
    db?: DbLike;
  }) {
    const db = input.db ?? prisma;

    return db.integrationAccount.findFirst({
      where: {
        tenantId: input.tenantId,
        ...(input.provider ? { provider: input.provider } : {}),
        status: {
          in: [IntegrationStatus.CONNECTED, IntegrationStatus.ERROR],
        },
      },
      select: {
        id: true,
        provider: true,
        status: true,
      },
      orderBy: [
        { lastSuccessfulSyncAt: "desc" },
        { connectedAt: "desc" },
        { provider: "asc" },
      ],
    });
  }

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
      {
        provider: ELDProvider.OTHER,
        label: "Other ELD",
        status: "planned",
        oauth: false,
        webhookSupported: false,
        notes: [
          "Credentials can be saved now while a provider-specific connector is added.",
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
    status?: IntegrationStatus;
    metadataJson?: Prisma.InputJsonValue | null;
    externalOrgId?: string | null;
    externalOrgName?: string | null;
  }) {
    const now = new Date();
    const status = input.status ?? IntegrationStatus.CONNECTED;
    const connectedAt = status === IntegrationStatus.CONNECTED ? now : null;
    const metadataJson = input.metadataJson
      ? JSON.parse(JSON.stringify(input.metadataJson))
      : undefined;
    const providerOrganizationData = {
      ...(typeof input.externalOrgId !== "undefined"
        ? { externalOrgId: input.externalOrgId }
        : {}),
      ...(typeof input.externalOrgName !== "undefined"
        ? { externalOrgName: input.externalOrgName }
        : {}),
    };

    return prisma.integrationAccount.upsert({
      where: {
        tenantId_provider: {
          tenantId: input.tenantId,
          provider: input.provider,
        },
      },
      update: {
        status,
        accessTokenEncrypted: encryptEldSecret(input.tokenSet.accessToken),
        refreshTokenEncrypted: input.tokenSet.refreshToken
          ? encryptEldSecret(input.tokenSet.refreshToken)
          : null,
        tokenExpiresAt: input.tokenSet.expiresAt,
        scopesJson: input.tokenSet.scopes,
        connectedAt,
        disconnectedAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        metadataJson,
        ...providerOrganizationData,
      },
      create: {
        tenantId: input.tenantId,
        provider: input.provider,
        status,
        accessTokenEncrypted: encryptEldSecret(input.tokenSet.accessToken),
        refreshTokenEncrypted: input.tokenSet.refreshToken
          ? encryptEldSecret(input.tokenSet.refreshToken)
          : null,
        tokenExpiresAt: input.tokenSet.expiresAt,
        scopesJson: input.tokenSet.scopes,
        connectedAt,
        metadataJson,
        ...providerOrganizationData,
      },
    });
  }

  static async ensureProviderOrganizationCanConnect(input: {
    provider: ELDProvider;
    tenantId: string;
    organization: ProviderOrganizationIdentity | null;
  }) {
    if (!input.organization?.externalOrgId) {
      throw new IftaAutomationError(
        "Motive connected, but the Motive company could not be identified. Add the companies.read scope and try again.",
        409,
        "ELD_PROVIDER_ORG_NOT_IDENTIFIED",
      );
    }

    const existingAccount = await prisma.integrationAccount.findFirst({
      where: {
        provider: input.provider,
        externalOrgId: input.organization.externalOrgId,
        tenantId: { not: input.tenantId },
        status: { not: IntegrationStatus.DISCONNECTED },
      },
      select: {
        id: true,
        tenant: {
          select: {
            name: true,
            legalName: true,
            companyName: true,
          },
        },
      },
    });

    if (existingAccount) {
      const tenantName =
        existingAccount.tenant.legalName ||
        existingAccount.tenant.companyName ||
        existingAccount.tenant.name ||
        "another client";

      throw new IftaAutomationError(
        `This Motive company is already connected to ${tenantName}. Sign out of Motive or choose the correct Motive account before connecting this client.`,
        409,
        "ELD_PROVIDER_ORG_ALREADY_CONNECTED",
      );
    }
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
    let providerOrganization: ProviderOrganizationIdentity | null = null;
    try {
      providerOrganization = adapter.identifyOrganization
        ? await adapter.identifyOrganization({ accessToken: tokenSet.accessToken })
        : null;
    } catch (error) {
      throw new IftaAutomationError(
        "Motive connected, but the Motive company could not be verified. Confirm companies.read is approved for this Motive app and try again.",
        409,
        "ELD_PROVIDER_ORG_VERIFICATION_FAILED",
        error instanceof IftaAutomationError
          ? { code: error.code, details: error.details }
          : undefined,
      );
    }

    await this.ensureProviderOrganizationCanConnect({
      provider: input.provider,
      tenantId: payload.tenantId,
      organization: providerOrganization,
    });

    const account = await this.persistTokenSet({
      tenantId: payload.tenantId,
      provider: input.provider,
      tokenSet,
      status: IntegrationStatus.PENDING,
      externalOrgId: providerOrganization?.externalOrgId,
      externalOrgName: providerOrganization?.externalOrgName,
      metadataJson: {
        oauthConnectedByUserId: payload.userId,
        oauthConnectedAt: new Date().toISOString(),
        oauthPendingConfirmation: true,
        providerOrganization: providerOrganization?.metadataJson ?? null,
      },
    });

    return {
      state: payload,
      account,
      redirectTo: payload.returnTo || "/ifta-v2",
      pendingConfirmation: account.status === IntegrationStatus.PENDING,
    };
  }

  static async confirmPendingConnection(input: {
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
      throw new IftaAutomationError(
        "No pending ELD integration was found for this tenant.",
        404,
        "ELD_INTEGRATION_NOT_FOUND",
      );
    }

    if (account.status !== IntegrationStatus.PENDING) {
      throw new IftaAutomationError(
        "This ELD integration is not waiting for confirmation.",
        409,
        "ELD_INTEGRATION_NOT_PENDING",
      );
    }

    if (!account.externalOrgId) {
      throw new IftaAutomationError(
        "The Motive company could not be verified for this pending connection.",
        409,
        "ELD_PROVIDER_ORG_NOT_IDENTIFIED",
      );
    }

    await this.ensureProviderOrganizationCanConnect({
      provider: input.provider,
      tenantId: tenant.id,
      organization: {
        externalOrgId: account.externalOrgId,
        externalOrgName: account.externalOrgName,
      },
    });

    const metadata =
      account.metadataJson && typeof account.metadataJson === "object" && !Array.isArray(account.metadataJson)
        ? (account.metadataJson as Record<string, unknown>)
        : {};

    return prisma.integrationAccount.update({
      where: { id: account.id },
      data: {
        status: IntegrationStatus.CONNECTED,
        connectedAt: new Date(),
        disconnectedAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        metadataJson: {
          ...metadata,
          oauthPendingConfirmation: false,
          oauthConfirmedByUserId: input.userId,
          oauthConfirmedAt: new Date().toISOString(),
        },
      },
    });
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
      await prisma.eldProviderCredential.deleteMany({
        where: { userId: input.userId },
      });
      return null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.eldProviderCredential.deleteMany({
        where: { userId: input.userId },
      });
      await tx.integrationWebhookEvent.deleteMany({
        where: { integrationAccountId: account.id },
      });
      await tx.integrationAccount.delete({
        where: { id: account.id },
      });
    });

    return {
      ...account,
      status: IntegrationStatus.DISCONNECTED,
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      disconnectedAt: new Date(),
    };
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
      where: {
        ...where,
        status: { not: IntegrationStatus.DISCONNECTED },
      },
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
