"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface StatCard {
  title: string;
  value: string;
  icon: string;
  color: string;
  href?: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // You can fetch actual stats from your API here
        // For now, we'll set up placeholder stats that you can customize
        const defaultStats: StatCard[] = [
          {
            title: "Total Users",
            value: "Loading...",
            icon: "👥",
            color: "bg-blue-500",
            href: "/dashboard/users",
          },
          {
            title: "Active Sessions",
            value: "1",
            icon: "🔐",
            color: "bg-green-500",
          },
          {
            title: "Roles",
            value: session?.user?.roles?.length?.toString() || "0",
            icon: "🎭",
            color: "bg-purple-500",
            href: "/admin/roles",
          },
          {
            title: "Permissions",
            value: session?.user?.permissions?.length?.toString() || "0",
            icon: "🔑",
            color: "bg-orange-500",
          },
        ];

        setStats(defaultStats);

        // Fetch actual user count if you have an API endpoint
        try {
          const userRes = await fetch("/api/v1/users");
          if (userRes.ok) {
            const userData = await userRes.json();
            const userCount = Array.isArray(userData.data)
              ? userData.data.length
              : userData.count || "Loading...";
            defaultStats[0].value = userCount.toString();
            setStats([...defaultStats]);
          }
        } catch (err) {
          // Silently fail - stats will show placeholder
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchDashboardData();
    }
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const isAdmin = session.user.roles?.includes("ADMIN") || false;

  return (
    <div className="flex-1 overflow-auto">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">
            Welcome, {session.user.name || session.user.email}! 👋
          </h1>
          <p className="text-blue-100 text-lg">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* User Info Card */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Account Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500 font-medium">Email</p>
              <p className="text-gray-900 font-semibold">{session.user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Roles</p>
              <p className="text-gray-900 font-semibold">
                {session.user.roles?.join(", ") || "No roles assigned"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Permissions</p>
              <p className="text-gray-900 font-semibold">
                {session.user.permissions?.length || 0} permissions
              </p>
            </div>
          </div>
          {session.user.permissions && session.user.permissions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 font-medium mb-2">
                Your Permissions
              </p>
              <div className="flex flex-wrap gap-2">
                {session.user.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <Link href={stat.href || "#"} key={stat.title}>
                <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer group">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-600 font-medium text-sm">
                      {stat.title}
                    </h3>
                    <span className="text-3xl">{stat.icon}</span>
                  </div>
                  <p className={`text-3xl font-bold text-white rounded p-2 ${stat.color} inline-block`}>
                    {stat.value}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/dashboard/settings">
              <button className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left">
                ⚙️ Account Settings
              </button>
            </Link>
            <Link href="/dashboard/users">
              <button className="w-full bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left">
                👥 Manage Users
              </button>
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin/roles">
                  <button className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left">
                    🎭 Manage Roles
                  </button>
                </Link>
                <Link href="/admin/users">
                  <button className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold py-4 px-6 rounded-lg transition-colors text-left">
                    🔑 Admin Panel
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Need Help?</h2>
          <p className="text-gray-600 mb-4">
            Check out our documentation or contact support for assistance.
          </p>
          <div className="flex gap-4">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
              📖 Documentation
            </button>
            <button className="bg-white border border-blue-300 text-blue-600 hover:bg-blue-50 font-semibold py-2 px-6 rounded-lg transition-colors">
              💬 Contact Support
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-center text-gray-500 text-sm">
            Last login: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
