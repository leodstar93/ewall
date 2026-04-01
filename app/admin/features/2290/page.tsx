import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/rbac";
import Form2290AdminQueuePage from "@/features/form2290/admin-queue-page";

export default async function AdminForm2290Page() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  return <Form2290AdminQueuePage showCreateButton={isAdmin} />;
}
