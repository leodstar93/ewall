import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

export default async function AdminSettingsPage() {
  const access = await requireAdminSettingsAccess("settings:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />

      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_55%,_#e0f2fe)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Admin Settings
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Configuration surfaces for operational modules.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Settings are admin-only. Use this area to manage shared system data that powers
          downstream workflows like manual IFTA calculations.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            General
          </p>
          <h3 className="mt-3 text-xl font-semibold text-zinc-950">Admin configuration</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Reserved for broader platform settings and operational defaults.
          </p>
        </article>

        <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            IFTA Tax Rates
          </p>
          <h3 className="mt-3 text-xl font-semibold text-zinc-950">
            Quarter tax-rate management
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Load U.S. jurisdiction rates, validate missing coverage, and apply manual admin
            overrides for the filing workflow.
          </p>
          <Link
            href="/admin/settings/ifta-tax-rates"
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Open IFTA Tax Rates
          </Link>
        </article>

        <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            UCR Rates
          </p>
          <h3 className="mt-3 text-xl font-semibold text-zinc-950">
            Annual UCR bracket management
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Maintain fleet-size brackets, activate or deactivate yearly rate tables, and
            control the fee engine used by the UCR compliance workflow.
          </p>
          <Link
            href="/admin/settings/ucr-rates"
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Open UCR Rates
          </Link>
        </article>
      </section>
    </div>
  );
}
