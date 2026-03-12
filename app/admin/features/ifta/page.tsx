import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthz } from "@/lib/rbac";

type IftaRow = {
  id: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  fuelType: "DI" | "GA";
  status: "DRAFT" | "FILED" | "AMENDED";
  totalMiles: unknown;
  totalGallons: unknown;
  averageMpg: unknown;
  totalTaxDue: unknown;
  createdAt: Date;
  updatedAt: Date;
  truck: {
    id: string;
    unitNumber: string;
    plateNumber: string | null;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  _count: {
    lines: number;
    trips: number;
    fuelPurchases: number;
  };
};

function userLabel(user: IftaRow["user"]) {
  return user.name?.trim() || user.email?.trim() || `User ${user.id.slice(0, 8)}`;
}

function userSubLabel(user: IftaRow["user"]) {
  if (user.name && user.email) return user.email;
  if (user.email) return user.email;
  return `ID: ${user.id}`;
}

function fuelLabel(value: IftaRow["fuelType"]) {
  return value === "DI" ? "Diesel" : "Gasoline";
}

function formatNumber(value: unknown) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: unknown) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: Date) {
  return value.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function quarterLabel(value: IftaRow["quarter"]) {
  if (value === "Q1") return "Q1 (Jan-Mar)";
  if (value === "Q2") return "Q2 (Apr-Jun)";
  if (value === "Q3") return "Q3 (Jul-Sep)";
  return "Q4 (Oct-Dec)";
}

function statusClass(status: IftaRow["status"]) {
  if (status === "FILED") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  }
  if (status === "AMENDED") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  }
  return "bg-zinc-100 text-zinc-700";
}

export default async function AdminIftaPage() {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  const backHref = isAdmin ? "/admin" : "/panel";
  const backLabel = isAdmin ? "Back to admin" : "Back to panel";

  const [reports, truckCount, tripCount, fuelPurchaseCount] = await Promise.all([
    prisma.iftaReport.findMany({
      orderBy: [{ year: "desc" }, { quarter: "desc" }, { createdAt: "desc" }],
      include: {
        truck: {
          select: {
            id: true,
            unitNumber: true,
            plateNumber: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            lines: true,
            trips: true,
            fuelPurchases: true,
          },
        },
      },
    }) as Promise<IftaRow[]>,
    prisma.truck.count(),
    prisma.trip.count(),
    prisma.fuelPurchase.count(),
  ]);

  const totalMiles = reports.reduce((acc, report) => acc + Number(report.totalMiles || 0), 0);
  const totalTaxDue = reports.reduce((acc, report) => acc + Number(report.totalTaxDue || 0), 0);
  const userCount = new Set(reports.map((report) => report.user.id)).size;

  return (
    <div className="flex-1 overflow-auto bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                  <span className="text-sm font-semibold">I</span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    IFTA reports
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    Review quarterly IFTA reports across all users.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              {backLabel}
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Total reports
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{reports.length}</p>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Users filing
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{userCount}</p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Trucks
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{truckCount}</p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Trips
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{tripCount}</p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Fuel purchases
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{fuelPurchaseCount}</p>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Total miles
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {formatNumber(totalMiles)}
              </p>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Tax due
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {formatCurrency(totalTaxDue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        {reports.length === 0 ? (
          <section className="rounded-2xl border bg-white p-10 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">No IFTA reports yet</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Reports will appear here once users start filing quarterly periods.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="overflow-hidden rounded-2xl border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Period
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Truck
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Totals
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Entries
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-zinc-900">
                            {userLabel(report.user)}
                          </p>
                          <p className="mt-1 text-sm text-zinc-600">{userSubLabel(report.user)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <p className="font-medium text-zinc-900">
                            {report.year} {quarterLabel(report.quarter)}
                          </p>
                          <p className="mt-1">{fuelLabel(report.fuelType)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {report.truck
                            ? `${report.truck.unitNumber}${report.truck.plateNumber ? ` (${report.truck.plateNumber})` : ""}`
                            : "Not assigned"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClass(report.status)}`}
                          >
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <p>{formatNumber(report.totalMiles)} mi</p>
                          <p>{formatNumber(report.totalGallons)} gal</p>
                          <p>{formatCurrency(report.totalTaxDue)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <p>Lines: {report._count.lines}</p>
                          <p>Trips: {report._count.trips}</p>
                          <p>Fuel: {report._count.fuelPurchases}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <p>{formatDate(report.updatedAt)}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Created {formatDate(report.createdAt)}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
