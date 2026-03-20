import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/rbac";
import DmvRegistrationForm from "@/features/dmv/registration-form";

export default async function AdminDmvNewPage() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  return <DmvRegistrationForm mode="staff" />;
}
