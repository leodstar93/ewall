import { getAuthz } from "@/lib/rbac";
import { redirect } from "next/navigation";
import TruckerProfileAdminClient from "./trucker-profile-admin-client";

export default async function AdminTruckerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");

  if (!isAdmin && !isStaff) {
    redirect("/forbidden");
  }

  const { id } = await params;
  return <TruckerProfileAdminClient truckerId={id} />;
}
