import { requireModuleAccess } from "@/lib/guards/require-module-access";
import { listAdminDocuments } from "@/lib/services/admin-documents.service";
import { getAuthz } from "@/lib/rbac";
import { redirect } from "next/navigation";
import DocumentsAdminClient from "./documents-admin-client";

export default async function DocumentPage() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");

  if (!isAdmin && !isStaff) {
    redirect("/forbidden");
  }

  await requireModuleAccess("documents");
  const data = await listAdminDocuments();

  return <DocumentsAdminClient data={data} />;
}
