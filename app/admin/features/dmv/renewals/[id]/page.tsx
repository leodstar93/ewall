import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/rbac";
import DmvRenewalDetailPage from "@/features/dmv-renewals/detail-page";

export default async function AdminDmvRenewalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  const { id } = await params;

  return <DmvRenewalDetailPage renewalId={id} mode="staff" />;
}
