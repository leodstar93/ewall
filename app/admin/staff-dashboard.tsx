import Link from "next/link";
import { prisma } from "@/lib/prisma";

type RecentDocument = {
  id: string;
  name: string;
  fileName: string;
  createdAt: Date;
  user: {
    name: string | null;
    email: string | null;
  };
};

type RecentIfta = {
  id: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  status: "DRAFT" | "FILED" | "AMENDED";
  updatedAt: Date;
  user: {
    name: string | null;
    email: string | null;
  };
};

type RecentUcr = {
  id: string;
  filingYear: number;
  legalName: string;
  status: string;
  updatedAt: Date;
  user: {
    name: string | null;
    email: string | null;
  };
};

function displayUser(user: { name: string | null; email: string | null }) {
  return user.name?.trim() || user.email?.trim() || "Unknown user";
}

export default async function StaffDashboardClient() {
  const [
    totalDocuments,
    totalReports,
    totalTrucks,
    totalFuelPurchases,
    totalUcrFilings,
    recentDocuments,
    recentReports,
    recentUcrFilings,
  ] = await Promise.all([
    prisma.document.count(),
    prisma.iftaReport.count(),
    prisma.truck.count(),
    prisma.fuelPurchase.count(),
    prisma.uCRFiling.count(),
    prisma.document.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        fileName: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }) as Promise<RecentDocument[]>,
    prisma.iftaReport.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        year: true,
        quarter: true,
        status: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
      },
    }) as Promise<RecentIfta[]>,
    prisma.uCRFiling.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        filingYear: true,
        legalName: true,
        status: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
      },
    }) as Promise<RecentUcr[]>,
  ]);

  const cards = [
    {
      title: "Documents",
      value: totalDocuments,
      href: "/admin/features/documents",
      hint: "Review uploads by user",
    },
    {
      title: "IFTA reports",
      value: totalReports,
      href: "/admin/features/ifta",
      hint: "Monitor quarterly filings",
    },
    {
      title: "Trucks",
      value: totalTrucks,
      href: "/admin/features/ifta",
      hint: "Fleet count in IFTA module",
    },
    {
      title: "Fuel purchases",
      value: totalFuelPurchases,
      href: "/admin/features/ifta",
      hint: "Fuel records across reports",
    },
    {
      title: "UCR filings",
      value: totalUcrFilings,
      href: "/admin/features/ucr",
      hint: "Annual compliance queue",
    },
  ] as const;

  return (
    <div className="flex-1 overflow-auto bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Staff dashboard
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Operational overview for Documents, IFTA, and UCR workflows.
              </p>
            </div>

            <Link
              href="/panel"
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              Back to panel
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {card.title}
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-900">{card.value}</p>
                <p className="mt-3 text-sm text-zinc-600">{card.hint}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-3">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Latest documents</h2>
            <Link
              href="/admin/features/documents"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Open documents
            </Link>
          </div>

          {recentDocuments.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No documents uploaded yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {recentDocuments.map((doc) => (
                <div key={doc.id} className="rounded-xl border p-3">
                  <p className="text-sm font-semibold text-zinc-900">{doc.name}</p>
                  <p className="text-xs text-zinc-600">{doc.fileName}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {displayUser(doc.user)} - {new Date(doc.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Latest IFTA updates</h2>
            <Link
              href="/admin/features/ifta"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Open IFTA
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No IFTA activity yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {recentReports.map((report) => (
                <div key={report.id} className="rounded-xl border p-3">
                  <p className="text-sm font-semibold text-zinc-900">
                    {report.year} {report.quarter} - {report.status}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {displayUser(report.user)} - {new Date(report.updatedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Latest UCR updates</h2>
            <Link
              href="/admin/features/ucr"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Open UCR
            </Link>
          </div>

          {recentUcrFilings.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No UCR activity yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {recentUcrFilings.map((filing) => (
                <div key={filing.id} className="rounded-xl border p-3">
                  <p className="text-sm font-semibold text-zinc-900">
                    {filing.filingYear} - {filing.legalName}
                  </p>
                  <p className="text-xs text-zinc-600">{filing.status}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {displayUser(filing.user)} - {new Date(filing.updatedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
