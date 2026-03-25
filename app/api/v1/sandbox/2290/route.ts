import { NextRequest } from "next/server";
import { Form2290Status } from "@prisma/client";
import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import {
  compute2290Compliance,
  Form2290ServiceError,
  form2290FilingInclude,
} from "@/services/form2290/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
}

export async function GET(request: NextRequest) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const status = request.nextUrl.searchParams.get("status");
    const taxPeriodId = request.nextUrl.searchParams.get("taxPeriodId");
    const compliance = request.nextUrl.searchParams.get("compliance");

    const filings = await ctx.db.form2290Filing.findMany({
      where: {
        ...(status && Object.values(Form2290Status).includes(status as Form2290Status)
          ? { status: status as Form2290Status }
          : {}),
        ...(taxPeriodId ? { taxPeriodId } : {}),
      },
      include: form2290FilingInclude,
      orderBy: [{ updatedAt: "desc" }],
    });

    const filtered = filings.filter((filing) => {
      if (!compliance) return true;

      const flags = compute2290Compliance({
        status: filing.status,
        paymentStatus: filing.paymentStatus,
        schedule1DocumentId: filing.schedule1DocumentId,
        expiresAt: filing.expiresAt,
        taxPeriodEndDate: filing.taxPeriod.endDate,
      });

      if (compliance === "compliant") return flags.compliant;
      if (compliance === "expired") return flags.expired;
      if (compliance === "non-compliant") return !flags.compliant;
      return true;
    });

    return Response.json({ filings: filtered });
  } catch (error) {
    return toErrorResponse(error, "Failed to load sandbox Form 2290 filings");
  }
}
