import { redirect } from "next/navigation";
import DmvDetailPage from "@/features/dmv/detail-page";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxDmvDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  const { id } = await params;

  return (
    <DmvDetailPage
      truckId={id}
      mode="staff"
      canUpdateRegistration
      canReviewRegistration
      canApproveRegistration
      trucksApiBasePath="/api/v1/sandbox/dmv/trucks"
      registrationsApiBasePath="/api/v1/sandbox/dmv/registrations"
      documentsApiBasePath="/api/v1/sandbox/documents"
      newRegistrationHref="/admin/sandbox/modules/dmv/new"
      renewalHrefBase={null}
    />
  );
}
