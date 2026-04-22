import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureBillingSettings } from "@/lib/services/billing-settings.service";

const BUILTIN_SUBSCRIPTION_MODULES = new Set(["ifta", "ucr"]);

export function isSubscriptionProtectedModule(module: {
  slug: string;
  requiresSubscription: boolean;
}) {
  return module.requiresSubscription || BUILTIN_SUBSCRIPTION_MODULES.has(module.slug);
}

export type ModuleAccessResult = {
  allowed: boolean;
  reason:
    | "OK"
    | "MODULE_NOT_FOUND"
    | "MODULE_INACTIVE"
    | "SUBSCRIPTIONS_DISABLED"
    | "FREE_MODULE"
    | "NO_ORGANIZATION"
    | "NO_ACTIVE_SUBSCRIPTION";
  source?: "plan" | "grant" | "billing_disabled" | "free_module" | "internal_role";
};

function isActiveGrantWindow(grant: { startsAt: Date | null; endsAt: Date | null }, now: Date) {
  if (grant.startsAt && grant.startsAt > now) return false;
  if (grant.endsAt && grant.endsAt < now) return false;
  return true;
}

function isSubscriptionAccessible(
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
  },
  gracePeriodDays: number,
  now: Date,
) {
  if (
    subscription.status === SubscriptionStatus.ACTIVE ||
    subscription.status === SubscriptionStatus.TRIALING
  ) {
    return true;
  }

  if (
    subscription.status === SubscriptionStatus.PAST_DUE &&
    subscription.currentPeriodEnd
  ) {
    const gracePeriodEnd = new Date(subscription.currentPeriodEnd);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + Math.max(gracePeriodDays, 0));
    return gracePeriodEnd >= now;
  }

  return false;
}

export async function getModuleAccess(
  organizationId: string,
  moduleSlug: string,
  options?: { bypassSubscription?: boolean },
): Promise<ModuleAccessResult> {
  const [settings, module] = await Promise.all([
    ensureBillingSettings(),
    prisma.appModule.findUnique({
      where: { slug: moduleSlug },
      select: {
        id: true,
        isActive: true,
        requiresSubscription: true,
      },
    }),
  ]);

  if (!module) {
    return {
      allowed: false,
      reason: "MODULE_NOT_FOUND",
    };
  }

  if (!module.isActive) {
    return {
      allowed: false,
      reason: "MODULE_INACTIVE",
    };
  }

  if (options?.bypassSubscription) {
    return {
      allowed: true,
      reason: "OK",
      source: "internal_role",
    };
  }

  if (!settings.subscriptionsEnabled || !settings.subscriptionsRequired) {
    return {
      allowed: true,
      reason: "SUBSCRIPTIONS_DISABLED",
      source: "billing_disabled",
    };
  }

  if (!isSubscriptionProtectedModule({ slug: moduleSlug, requiresSubscription: module.requiresSubscription })) {
    return {
      allowed: true,
      reason: "FREE_MODULE",
      source: "free_module",
    };
  }

  if (!organizationId) {
    return {
      allowed: false,
      reason: "NO_ORGANIZATION",
    };
  }

  const now = new Date();

  const activeGrant = await prisma.subscriptionGrant.findFirst({
    where: {
      organizationId,
      moduleId: module.id,
      active: true,
    },
    orderBy: { createdAt: "desc" },
    select: {
      startsAt: true,
      endsAt: true,
    },
  });

  if (activeGrant && isActiveGrantWindow(activeGrant, now)) {
    return {
      allowed: true,
      reason: "OK",
      source: "grant",
    };
  }

  const subscriptions = await prisma.organizationSubscription.findMany({
    where: {
      organizationId,
      status: {
        in: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.PAST_DUE,
        ],
      },
    },
    orderBy: [
      { currentPeriodEnd: "desc" },
      { updatedAt: "desc" },
    ],
    select: {
      status: true,
      currentPeriodEnd: true,
      plan: {
        select: {
          modules: {
            select: {
              module: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const matchingSubscription = subscriptions.find((subscription) => {
    if (!subscription.plan) return false;
    if (!isSubscriptionAccessible(subscription, settings.defaultGracePeriodDays, now)) {
      return false;
    }

    return subscription.plan.modules.some(
      (planModule) => planModule.module.slug === moduleSlug,
    );
  });

  if (matchingSubscription) {
    return {
      allowed: true,
      reason: "OK",
      source: "plan",
    };
  }

  return {
    allowed: false,
    reason: "NO_ACTIVE_SUBSCRIPTION",
  };
}
