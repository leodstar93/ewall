import { getAuthz } from "@/lib/rbac";
import { redirect } from "next/navigation";
import UserProfileAdminClient from "./user-profile-admin-client";

export default async function AdminUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");
  if (!roles.includes("ADMIN")) redirect("/forbidden");

  const { id } = await params;
  return <UserProfileAdminClient userId={id} />;
}
