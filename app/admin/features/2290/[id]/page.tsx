import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/rbac";
import Form2290DetailPage from "@/features/form2290/detail-page";

export default async function AdminForm2290DetailPage({
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
  return <Form2290DetailPage filingId={id} mode="staff" />;
}
