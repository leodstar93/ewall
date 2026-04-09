import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/rbac";
import UcrAdminQueueClient from "./ucr-admin-queue-client";

export default async function AdminUcrPage() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  return <UcrAdminQueueClient />;
}
