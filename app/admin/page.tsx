import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminPage() {
  const session = await auth();

  // Check if user is admin
  if (!session?.user || !session.user.roles?.includes("ADMIN")) {
    redirect("/dashboard");
  }

  // Fetch admin stats
  const [totalUsers, totalRoles, totalPermissions, totalSessions] =
    await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.session.count(),
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
  });

  const stats = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: "👥",
      color: "bg-blue-500",
      href: "/admin/users",
    },
    {
      label: "Active Sessions",
      value: totalSessions,
      icon: "🔐",
      color: "bg-green-500",
    },
    {
      label: "Roles",
      value: totalRoles,
      icon: "🎭",
      color: "bg-purple-500",
      href: "/admin/roles",
    },
    {
      label: "Permissions",
      value: totalPermissions,
      icon: "🔑",
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="flex-1 overflow-auto">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 text-white px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-red-100 text-lg">
            System Management & Configuration
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Admin Info Alert */}
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <span className="text-2xl mr-4">🛡️</span>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-1">
                Administrator Panel
              </h3>
              <p className="text-blue-700">
                You have full access to system administration tools. Use this
                panel to manage users, roles, permissions, and system
                configuration.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            System Statistics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) =>
              stat.href ? (
                <Link href={stat.href} key={stat.label}>
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-gray-600 font-medium text-sm">
                        {stat.label}
                      </h3>
                      <span className="text-3xl">{stat.icon}</span>
                    </div>
                    <p
                      className={`text-3xl font-bold text-white rounded p-2 ${stat.color} inline-block`}
                    >
                      {stat.value}
                    </p>
                  </div>
                </Link>
              ) : (
                <div
                  key={stat.label}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-600 font-medium text-sm">
                      {stat.label}
                    </h3>
                    <span className="text-3xl">{stat.icon}</span>
                  </div>
                  <p
                    className={`text-3xl font-bold text-white rounded p-2 ${stat.color} inline-block`}
                  >
                    {stat.value}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Admin Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Admin Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/admin/users">
              <button className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left border border-blue-200">
                👥 Manage Users
              </button>
            </Link>
            <Link href="/admin/roles">
              <button className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left border border-purple-200">
                🎭 Manage Roles
              </button>
            </Link>
            <Link href="/admin/permissions">
              <button className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left border border-orange-200">
                🔑 Manage Permissions
              </button>
            </Link>
            <button className="w-full bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left border border-green-200">
              📊 View Analytics
            </button>
            <button className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left border border-indigo-200">
              ⚙️ System Settings
            </button>
            <button className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left border border-red-200">
              📋 View Logs
            </button>
          </div>
        </div>

        {/* Roles Overview */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Roles Overview
          </h2>
          {roles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Role Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Permissions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">
                          {role.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {role.description || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {role._count.users}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          {role._count.permissions}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No roles found</p>
            </div>
          )}
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Users</h2>
            <Link href="/admin/users">
              <button className="text-blue-600 hover:text-blue-700 font-semibold">
                View All →
              </button>
            </Link>
          </div>
          {recentUsers.length > 0 ? (
            <div className="space-y-4">
              {recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {user.name || user.email}
                    </h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <div className="flex gap-2 mt-2">
                      {user.roles.map((r) => (
                        <span
                          key={r.role.name}
                          className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full"
                        >
                          {r.role.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <p>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No users found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}