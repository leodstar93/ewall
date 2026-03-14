import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import UcrFilingForm from "@/features/ucr/filing-form";

export default async function NewUcrFilingPage() {
  const permission = await requirePermission("ucr:create");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_50%,_#dcfce7)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          New UCR Filing
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Create the annual registration record for your company.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Save a draft first or submit directly once the company profile, fleet size, and
          supporting details are ready.
        </p>
      </section>

      <UcrFilingForm mode="create" />
    </div>
  );
}
