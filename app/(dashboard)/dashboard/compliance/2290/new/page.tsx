import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac-guard";
import Form2290FilingForm from "@/features/form2290/filing-form";

export default async function NewForm2290Page() {
  const permission = await requirePermission("compliance2290:create");

  if (!permission.ok) {
    redirect(permission.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#dcfce7)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          New Form 2290
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Start the annual HVUT filing for a heavy vehicle.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Save a draft first, then continue the review, payment, and Schedule 1 steps from the filing detail page.
        </p>
      </section>

      <Form2290FilingForm mode="create" detailHrefBase="/dashboard/compliance/2290" />
    </div>
  );
}
