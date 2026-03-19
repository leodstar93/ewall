import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import Form2290DetailPage from "@/features/form2290/detail-page";

export default async function Form2290DetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const permission = await requirePermission("compliance2290:view");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const { id } = await params;
  return <Form2290DetailPage filingId={id} mode="driver" />;
}
