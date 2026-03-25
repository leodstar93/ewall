import DmvDetailPage from "@/features/dmv/detail-page";

export default async function SandboxClientDmvDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <DmvDetailPage
      truckId={id}
      mode="driver"
      canUpdateRegistration
      canReviewRegistration={false}
      canApproveRegistration={false}
      trucksApiBasePath="/api/v1/sandbox/client/dmv/trucks"
      registrationsApiBasePath="/api/v1/sandbox/client/dmv/registrations"
      documentsApiBasePath="/api/v1/sandbox/client/documents"
      newRegistrationHref="/admin/sandbox/view/dmv/new"
      renewalHrefBase={null}
    />
  );
}
