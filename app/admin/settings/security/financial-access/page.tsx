import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";

function normalizeFilter(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export default async function FinancialAccessAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAdminSettingsAccess("financial_audit:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const params = await searchParams;
  const actor = normalizeFilter(params.actor);
  const target = normalizeFilter(params.target);
  const filing = normalizeFilter(params.filing);
  const action = normalizeFilter(params.action);
  const dateFrom = normalizeFilter(params.dateFrom);
  const dateTo = normalizeFilter(params.dateTo);

  const where: Prisma.FinancialAccessAuditWhereInput = {};
  const andClauses: Prisma.FinancialAccessAuditWhereInput[] = [];

  if (actor) {
    andClauses.push({
      actorUser: {
        is: {
          OR: [
            { id: { contains: actor, mode: "insensitive" } },
            { email: { contains: actor, mode: "insensitive" } },
            { name: { contains: actor, mode: "insensitive" } },
          ],
        },
      },
    });
  }

  if (target) {
    andClauses.push({
      targetUser: {
        is: {
          OR: [
            { id: { contains: target, mode: "insensitive" } },
            { email: { contains: target, mode: "insensitive" } },
            { name: { contains: target, mode: "insensitive" } },
          ],
        },
      },
    });
  }

  if (filing) {
    andClauses.push({
      OR: [
        { filingId: { contains: filing, mode: "insensitive" } },
        { resourceId: { contains: filing, mode: "insensitive" } },
      ],
    });
  }

  if (action) {
    andClauses.push({
      action: {
        equals: action,
        mode: "insensitive",
      },
    });
  }

  if (dateFrom || dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (dateFrom) {
      const parsed = new Date(dateFrom);
      if (!Number.isNaN(parsed.getTime())) {
        createdAt.gte = parsed;
      }
    }
    if (dateTo) {
      const parsed = new Date(`${dateTo}T23:59:59.999Z`);
      if (!Number.isNaN(parsed.getTime())) {
        createdAt.lte = parsed;
      }
    }
    andClauses.push({ createdAt });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  const audits = await prisma.financialAccessAudit.findMany({
    where,
    include: {
      actorUser: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
      paymentMethod: {
        select: {
          bankName: true,
          id: true,
          label: true,
          last4: true,
        },
      },
      targetUser: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_55%,_#eff6ff)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Security
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Financial access audit log
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Review who created, revealed, authorized, revoked, or used ACH custody vault
          records across filings and registrations.
        </p>
        <Link
          href="/admin/settings"
          className="mt-5 inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          Back to settings
        </Link>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <form className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Actor</span>
            <input name="actor" defaultValue={actor} className="w-full rounded-2xl border border-zinc-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Target</span>
            <input name="target" defaultValue={target} className="w-full rounded-2xl border border-zinc-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Filing or resource</span>
            <input name="filing" defaultValue={filing} className="w-full rounded-2xl border border-zinc-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Action</span>
            <input name="action" defaultValue={action} className="w-full rounded-2xl border border-zinc-200 px-4 py-3" placeholder="REVEAL" />
          </label>
          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Date from</span>
            <input type="date" name="dateFrom" defaultValue={dateFrom} className="w-full rounded-2xl border border-zinc-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Date to</span>
            <input type="date" name="dateTo" defaultValue={dateTo} className="w-full rounded-2xl border border-zinc-200 px-4 py-3" />
          </label>
          <div className="flex flex-wrap items-end gap-3 lg:col-span-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Apply filters
            </button>
            <Link
              href="/admin/settings/security/financial-access"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Recent audit entries</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Showing the latest {audits.length} matching records.
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Filing</th>
                  <th className="px-4 py-3">Payment method</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {audits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
                      No financial access audits matched these filters.
                    </td>
                  </tr>
                ) : (
                  audits.map((audit) => (
                    <tr key={audit.id}>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {audit.createdAt.toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-zinc-950">
                        {audit.action}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {[audit.actorUser.name, audit.actorUser.email].filter(Boolean).join(" | ") || audit.actorUserId}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {audit.targetUser
                          ? [audit.targetUser.name, audit.targetUser.email].filter(Boolean).join(" | ")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {audit.filingType && audit.filingId ? `${audit.filingType} | ${audit.filingId}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {audit.paymentMethod
                          ? [
                              audit.paymentMethod.label || audit.paymentMethod.bankName || audit.paymentMethod.id,
                              audit.paymentMethod.last4 ? `****${audit.paymentMethod.last4}` : null,
                            ]
                              .filter(Boolean)
                              .join(" | ")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {audit.reason || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
