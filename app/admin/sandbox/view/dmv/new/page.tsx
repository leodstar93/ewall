import DmvRegistrationForm from "@/features/dmv/registration-form";

export default function SandboxClientDmvNewPage() {
  return (
    <DmvRegistrationForm
      mode="driver"
      trucksApiPath="/api/v1/sandbox/client/dmv/trucks"
      jurisdictionsApiPath="/api/v1/sandbox/client/dmv/settings/jurisdictions"
      registrationsApiPath="/api/v1/sandbox/client/dmv/registrations"
      detailHrefBase="/admin/sandbox/view/dmv"
    />
  );
}
