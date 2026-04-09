import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { listAdminUcrQueue } from "@/lib/services/admin-ucr.service";

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("ucr:read_all");
  if (!guard.ok) return guard.res;

  try {
    const filings = await listAdminUcrQueue({
      year: request.nextUrl.searchParams.get("year"),
      status: request.nextUrl.searchParams.get("status"),
      paymentState: request.nextUrl.searchParams.get("paymentState"),
      officialPaymentState: request.nextUrl.searchParams.get("officialPaymentState"),
      search: request.nextUrl.searchParams.get("search"),
    });

    return Response.json({ filings });
  } catch (error) {
    console.error("Failed to load admin UCR queue", error);
    return Response.json({ error: "Failed to load admin UCR queue" }, { status: 500 });
  }
}
