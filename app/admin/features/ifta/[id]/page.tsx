import { redirect } from "next/navigation";
import IftaManualReportPage from "@/features/ifta/manual-report-page";
import { getAuthz } from "@/lib/rbac";

export default async function AdminIftaReportPage({
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

  return <IftaManualReportPage reportId={id} mode="staff" />;
}
