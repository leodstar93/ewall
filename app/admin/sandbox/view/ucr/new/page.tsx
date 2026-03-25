import UcrFilingForm from "@/features/ucr/filing-form";

export default function SandboxClientUcrNewPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_50%,_#dcfce7)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Sandbox UCR Filing
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Create the annual registration record as the active demo user.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          This uses the real sandbox workflow with isolated data, uploads, and audit logs.
        </p>
      </section>

      <UcrFilingForm
        mode="create"
        apiBasePath="/api/v1/sandbox/client/ucr"
        detailHrefBase="/admin/sandbox/view/ucr"
      />
    </div>
  );
}
