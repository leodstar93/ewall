import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import UcrDetailPage from "@/features/ucr/detail-page";

export default async function UcrDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const permission = await requirePermission("ucr:read");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const { id } = await params;

  return <UcrDetailPage filingId={id} mode="driver" />;
}
