import { getAuthz } from "@/lib/rbac";
import { redirect } from "next/navigation";
import DbAdminClient from "./db-admin-client";

export default async function DbAdminPage() {
  const { roles } = await getAuthz();
  if (!roles.includes("ADMIN")) redirect("/forbidden");
  return <DbAdminClient />;
}
