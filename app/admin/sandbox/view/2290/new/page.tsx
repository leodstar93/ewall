import Form2290FilingForm from "@/features/form2290/filing-form";

export default function SandboxClient2290NewPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#dcfce7)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Sandbox Form 2290
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Start the annual HVUT filing as the active demo user.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          This runs on sandbox data and isolated document storage, without touching production records.
        </p>
      </section>

      <Form2290FilingForm
        mode="create"
        detailHrefBase="/admin/sandbox/view/2290"
        apiBasePath="/api/v1/sandbox/client/2290"
        vehiclesApiPath="/api/v1/sandbox/client/2290/vehicles"
        taxPeriodsApiPath="/api/v1/sandbox/client/2290/tax-periods"
      />
    </div>
  );
}
