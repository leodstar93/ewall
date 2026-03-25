import { redirect } from "next/navigation";
import DmvRegistrationForm from "@/features/dmv/registration-form";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxDmvNewPage() {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  return (
    <DmvRegistrationForm
      mode="staff"
      trucksApiPath="/api/v1/sandbox/dmv/trucks"
      jurisdictionsApiPath="/api/v1/sandbox/dmv/settings/jurisdictions"
      registrationsApiPath="/api/v1/sandbox/dmv/registrations"
      detailHrefBase="/admin/sandbox/modules/dmv"
    />
  );
}
