import { auth } from "@/auth";
import { getAuthz } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authSession = await auth();
  if (!authSession?.user?.id) {
    redirect("/login");
  }

  const { roles } = await getAuthz();
  const { id } = await params;

  if (authSession.user.id !== id) {
    redirect("/forbidden");
  }

  if (
    authSession.user.id === id &&
    (roles.includes("STAFF") || roles.includes("ADMIN"))
  ) {
    redirect("/admin/profile");
  }

  redirect("/settings");
}
