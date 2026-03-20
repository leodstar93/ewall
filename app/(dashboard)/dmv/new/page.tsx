import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import DmvRegistrationForm from "@/features/dmv/registration-form";

export default async function NewDmvRegistrationPage() {
  const permission = await requirePermission("dmv:create");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return <DmvRegistrationForm />;
}
