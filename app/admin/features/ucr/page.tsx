import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/rbac";
import UcrAdminQueuePage from "@/features/ucr/admin-queue-page";

export default async function AdminUcrPage() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  return <UcrAdminQueuePage />;
}
