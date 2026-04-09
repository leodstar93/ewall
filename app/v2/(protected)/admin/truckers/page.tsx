import { getAuthz } from "@/lib/rbac";
import { redirect } from "next/navigation";
import TruckerDirectoryClient from "./trucker-directory-client";

export default async function AdminTruckersPage() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");

  if (!isAdmin && !isStaff) {
    redirect("/forbidden");
  }

  return <TruckerDirectoryClient />;
}
