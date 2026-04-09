import { redirect } from "next/navigation";

export default function AdminFeatureDocumentsRedirectPage() {
  redirect("/v2/admin/documents");
}
