"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface UserDetail {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  roles: Array<{ role: Role }>;
}

export default function UserDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoles, setEditingRoles] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const userId = pathname.split("/").pop();

  // redirect if not admin
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (
      status === "authenticated" &&
      !session?.user?.roles?.includes("ADMIN")
    ) {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const [uRes, rRes] = await Promise.all([
          fetch(`/api/v1/users/${userId}`),
          fetch(`/api/v1/roles`),
        ]);
        if (uRes.ok) {
          const data = await uRes.json();
          setUser(data);
          setSelectedRoles(data.roles.map((r: any) => r.role.id));
        }
        if (rRes.ok) {
          const data = await rRes.json();
          setRoles(Array.isArray(data) ? data : data.data || []);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    if (session?.user?.roles?.includes("ADMIN")) {
      fetchData();
    }
  }, [userId, session]);

  const handleSaveRoles = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/v1/users/${userId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selectedRoles }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setEditingRoles(false);
      } else {
        alert("Failed to update roles");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating roles");
    }
  };

  const handleDelete = async () => {
    if (!userId) return;
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/users");
      } else {
        const e = await res.json();
        alert(e.error || "Failed to delete user");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting user");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user...</p>
        </div>
      </div>
    );
  }

  if (!session?.user?.roles?.includes("ADMIN")) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">User not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-8 py-12">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {user.name || user.email}
            </h1>
            <p className="text-blue-100 text-lg">User details & roles</p>
          </div>
          <Link href="/admin/users">
            <button className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
              ← Back to Users
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Account Information
          </h2>
          <p><strong>Email:</strong> {user.email || "—"}</p>
          <p><strong>Name:</strong> {user.name || "—"}</p>
          <p><strong>Joined:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Roles</h2>
            {!editingRoles && (
              <button
                onClick={() => setEditingRoles(true)}
                className="text-blue-600 hover:underline text-sm"
              >
                Edit
              </button>
            )}
          </div>
          {editingRoles ? (
            <div className="space-y-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRoles([...selectedRoles, role.id]);
                      } else {
                        setSelectedRoles(selectedRoles.filter((r) => r !== role.id));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="ml-3 text-gray-700">
                    {role.name}
                    {role.description && (
                      <span className="text-sm text-gray-500 block">
                        {role.description}
                      </span>
                    )}
                  </span>
                </label>
              ))}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleSaveRoles}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingRoles(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user.roles.length > 0 ? (
                user.roles.map((r) => (
                  <span
                    key={r.role.id}
                    className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full"
                  >
                    {r.role.name}
                  </span>
                ))
              ) : (
                <span className="text-gray-500">No roles assigned</span>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleDelete}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Delete User
          </button>
        </div>
      </div>
    </div>
  );
}
