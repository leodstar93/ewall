import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/rbac";
import UcrDetailPage from "@/features/ucr/detail-page";

export default async function AdminUcrDetailPage({
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

  return <UcrDetailPage filingId={id} mode="staff" />;
}
