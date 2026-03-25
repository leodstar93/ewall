import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getActingContext } from "@/lib/auth/get-acting-context";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

type SandboxLayoutProps = {
  children: ReactNode;
};

export default async function SandboxLayout({ children }: SandboxLayoutProps) {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  const actingContext = await getActingContext();

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-100 via-orange-100 to-amber-50 px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">
              Sandbox Mode
            </p>
            <p className="mt-1 text-sm text-amber-900">
              No real production data is being modified.
              {actingContext.isImpersonating
                ? ` Acting as ${actingContext.actingAsUserName ?? actingContext.actingAsRole ?? "demo user"}.`
                : " No impersonation session is active."}
            </p>
          </div>
          <div className="rounded-full border border-amber-300 bg-white/80 px-3 py-1 text-xs font-medium text-amber-900">
            {actingContext.isImpersonating
              ? `Acting as ${actingContext.actingAsUserEmail ?? actingContext.actingAsRole ?? "demo"}`
              : "Viewing as internal operator"}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
