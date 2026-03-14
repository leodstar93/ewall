import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AdminRolesOverviewTable from "@/components/admin/AdminRolesOverviewTable";

export default async function AdminPageClient() {
  const session = await auth();
  const currentYear = new Date().getFullYear();

  // Check if user is admin
  if (!session?.user || !session.user.roles?.includes("ADMIN")) {
    redirect("/panel");
  }

  // Fetch admin stats
  const [
    totalUsers,
    totalRoles,
    totalPermissions,
    totalSessions,
    totalCurrentYearUcr,
    compliantCurrentYearUcr,
    correctionCurrentYearUcr,
    pendingProofCurrentYearUcr,
  ] =
    await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.session.count(),
      prisma.uCRFiling.count({ where: { filingYear: currentYear } }),
      prisma.uCRFiling.count({ where: { filingYear: currentYear, status: "COMPLIANT" } }),
      prisma.uCRFiling.count({
        where: { filingYear: currentYear, status: "CORRECTION_REQUESTED" },
      }),
      prisma.uCRFiling.count({ where: { filingYear: currentYear, status: "PENDING_PROOF" } }),
    ]);

  // Fetch recent users
  const recentUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      roles: {
        select: {
          role: { select: { name: true } },
        },
      },
    },
  });

  // Fetch all roles
  const roles = await prisma.role.findMany({
    include: {
      _count: {
        select: { users: true, permissions: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const stats = [
    {
      label: "Total users",
      value: totalUsers,
      icon: "👥",
      href: "/admin/users",
      badge: "Directory",
    },
    {
      label: "Active sessions",
      value: totalSessions,
      icon: "🔐",
      href: null,
      badge: "Live",
    },
    {
      label: "Roles",
      value: totalRoles,
      icon: "🎭",
      href: "/admin/roles",
      badge: "RBAC",
    },
    {
      label: "Permissions",
      value: totalPermissions,
      icon: "🔑",
      href: "/admin/permissions",
      badge: "Policies",
    },
  ] as const;

  const quickActions = [
  {
    title: "Manage users",
    desc: "Invite, assign roles, and control access.",
    icon: "👥",
    href: "/admin/users",
    tone: "blue",
  },
  {
    title: "Manage roles",
    desc: "Create roles and keep permissions organized.",
    icon: "🎭",
    href: "/admin/roles",
    tone: "purple",
  },
  {
    title: "Manage permissions",
    desc: "Define fine-grained access rules by module.",
    icon: "🔑",
    href: "/admin/permissions",
    tone: "orange",
  },
  {
    title: "Review IFTA reports",
    desc: "Audit user IFTA filing status and totals.",
    icon: "🚚",
    href: "/admin/features/ifta",
    tone: "green",
  },
  {
    title: "Review UCR filings",
    desc: "Track annual compliance and outstanding proof.",
    icon: "ðŸ›¡ï¸",
    href: "/admin/features/ucr",
    tone: "blue",
  },
] as const;

  return (
    <div className="flex-1 overflow-auto bg-zinc-50">
      {/* Top header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                  <span className="text-sm font-semibold">A</span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Admin dashboard
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    System overview, access control, and management tools.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/panel"
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              ← Back to Panel
            </Link>
          </div>

          {/* Info strip */}
          <div className="mt-6 rounded-2xl border bg-zinc-50 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-lg">🛡️</div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  Administrator panel
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  You have full access to system administration tools. Manage
                  users, roles, and permissions carefully to keep RBAC clean and
                  scalable.
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => {
              const Card = (
                <div className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {s.label}
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-zinc-900">
                        {s.value}
                      </p>
                    </div>

                    <div className="text-2xl">{s.icon}</div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-700">
                      {s.badge}
                    </span>

                    {s.href ? (
                      <span className="text-sm font-medium text-zinc-700">
                        View →
                      </span>
                    ) : (
                      <span className="text-sm text-zinc-500">—</span>
                    )}
                  </div>
                </div>
              );

              return s.href ? (
                <Link key={s.label} href={s.href} className="block">
                  {Card}
                </Link>
              ) : (
                <div key={s.label}>{Card}</div>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                Quick actions
              </h2>
              <span className="text-sm text-zinc-500">
                Most common admin tasks
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {quickActions.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {a.title}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">{a.desc}</p>
                    </div>
                    <div className="text-2xl">{a.icon}</div>
                  </div>

                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    Open <span aria-hidden>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                UCR operations
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Current-year workflow visibility for annual compliance.
              </p>
            </div>

            <Link
              href="/admin/features/ucr"
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              Open UCR â†’
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {currentYear} filings
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {totalCurrentYearUcr}
              </p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Compliant
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {compliantCurrentYearUcr}
              </p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Corrections
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {correctionCurrentYearUcr}
              </p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Pending proof
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {pendingProofCurrentYearUcr}
              </p>
            </div>
          </div>
        </section>

        {/* Roles overview */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Roles overview
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                A quick snapshot of role usage and assigned permissions.
              </p>
            </div>

            <Link
              href="/admin/roles"
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              Manage roles →
            </Link>
          </div>

          <AdminRolesOverviewTable roles={roles} />
          {false && (
            <div className="mt-6 overflow-hidden rounded-2xl border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Role
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Description
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Users
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Permissions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {roles.map((role) => (
                      <tr key={role.id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-zinc-900">
                            {role.name}
                          </span>
                          {role.name === "ADMIN" && (
                            <span className="ml-2 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white">
                              System
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {role.description || "—"}
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                            {role._count.users}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                            {role._count.permissions}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {false && (
            <div className="mt-6 rounded-2xl border bg-zinc-50 p-6 text-sm text-zinc-600">
              No roles found.
            </div>
          )}
        </section>

        {/* Recent users */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Recent users
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Latest signups and assigned roles.
              </p>
            </div>

            <Link
              href="/admin/users"
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              View all →
            </Link>
          </div>

          {recentUsers.length > 0 ? (
            <div className="mt-6 space-y-3">
              {recentUsers.map((u) => {
                const displayName = u.name || u.email || "User";
                return (
                  <div
                    key={u.id}
                    className="flex flex-col gap-3 rounded-2xl border p-5 transition hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {displayName}
                      </p>
                      <p className="truncate text-sm text-zinc-600">
                        {u.email}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {u.roles.length > 0 ? (
                          u.roles.map((r) => (
                            <span
                              key={r.role.name}
                              className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-100"
                            >
                              {r.role.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500">
                            No roles
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-zinc-500 sm:text-right">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border bg-zinc-50 p-6 text-sm text-zinc-600">
              No users found.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
