import { UCRCustomerPaymentStatus, UCRFilingStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { createCheckoutSession } from "@/services/ucr/createCheckoutSession";
import { createPricingSnapshot } from "@/services/ucr/createPricingSnapshot";
import { logUcrEvent } from "@/services/ucr/logUcrEvent";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import { UcrServiceError } from "@/services/ucr/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:checkout");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const filing = await prisma.uCRFiling.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    if (filing.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (filing.status !== UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT) {
      return Response.json(
        { error: "This filing is not ready for checkout." },
        { status: 409 },
      );
    }

    const setting = await prisma.uCRAdminSetting.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (setting?.conciergeModeEnabled === false) {
      return Response.json(
        { error: "UCR concierge mode is disabled." },
        { status: 409 },
      );
    }

    if (setting?.allowCustomerCheckout === false) {
      return Response.json(
        { error: "Customer checkout is currently disabled for UCR." },
        { status: 409 },
      );
    }

    await createPricingSnapshot({
      db: prisma,
    }, {
      filingId: filing.id,
    });

    const session = await createCheckoutSession({
      filingId: filing.id,
      userId: filing.userId,
      userEmail: filing.user.email,
      userName: filing.user.name,
    });

    await prisma.$transaction(async (tx) => {
      await tx.uCRFiling.update({
        where: { id: filing.id },
        data: {
          stripeCheckoutSessionId: session.id,
          customerPaymentStatus: UCRCustomerPaymentStatus.PENDING,
        },
      });

      await transitionUcrStatus({ db: tx }, {
        filingId: filing.id,
        toStatus: UCRFilingStatus.CUSTOMER_PAYMENT_PENDING,
        actorUserId: guard.session.user.id ?? null,
        eventType: "ucr.customer_payment.pending",
        message: "Stripe Checkout session created for UCR payment.",
      });

      await logUcrEvent({ db: tx }, {
        filingId: filing.id,
        actorUserId: guard.session.user.id ?? null,
        eventType: "ucr.checkout.session_created",
        message: "Stripe Checkout session created.",
        metaJson: {
          stripeCheckoutSessionId: session.id,
          amountTotal: session.amount_total,
        },
      });
    });

    return Response.json({
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to create UCR checkout session");
  }
}
