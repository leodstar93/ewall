import { requireApiPermission } from "@/lib/rbac-api";
import { getPaymentConfiguration } from "@/lib/services/payment.service";

export async function GET() {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  return Response.json(getPaymentConfiguration());
}
