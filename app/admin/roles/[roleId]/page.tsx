"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions?: Array<{
    id: string;
    key: string;
    description: string | null;
  }>;
  users?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

interface Permission {
  id: string;
  key: string;
  description: string | null;
}

type Toast = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function RoleDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
    const roleId = params.roleId as string;
    console.log("roleId:", roleId);

  const [role, setRole] = useState<Role | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ description: "" });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  const pushToast = (t: Omit<Toast, "id">) => {
    const id = uid();
    const toast: Toast = { id, ...t };
    setToasts((prev) => [toast, ...prev]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== toast.id));
    }, 3500);
  };

  const isAdmin = !!session?.user?.roles?.includes("ADMIN");

  // Check admin access
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !isAdmin) router.replace("/panel");
  }, [status, isAdmin, router]);

  // Fetch role and permissions
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch role details
        const roleRes = await fetch(`/api/v1/roles/${roleId}`);
        if (!roleRes.ok) throw new Error("Failed to fetch role");
        const roleData = await roleRes.json();
        setRole(roleData);
        setFormData({ description: roleData.description || "" });

        // Extract permission IDs
        setSelectedPermissions(
          (roleData.permissions || []).map((p: Permission) => p.id)
        );

        // Fetch all permissions
        const permsRes = await fetch("/api/v1/permissions");
        if (permsRes.ok) {
          const permsData = await permsRes.json();
          setAllPermissions(permsData.permissions || permsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        pushToast({
          type: "error",
          message: "Failed to load role details",
        });
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin && roleId) fetchData();
  }, [roleId, isAdmin]);

  useEffect(() => {
    setUsersPage(1);
  }, [usersPageSize, role?.users?.length]);

  const handleSaveDescription = async () => {
    try {
      const response = await fetch(`/api/v1/roles/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: formData.description || null }),
      });

      if (response.ok) {
        const updated = await response.json();
        setRole(updated);
        setIsEditing(false);
        pushToast({
          type: "success",
          message: "Role description updated",
        });
      } else {
        pushToast({
          type: "error",
          message: "Failed to update role description",
        });
      }
    } catch (error) {
      console.error("Error updating role:", error);
      pushToast({
        type: "error",
        message: "An error occurred",
      });
    }
  };

  const handleTogglePermission = async (permissionId: string) => {
    const isSelected = selectedPermissions.includes(permissionId);
    const newSelected = isSelected
      ? selectedPermissions.filter((id) => id !== permissionId)
      : [...selectedPermissions, permissionId];

    setSelectedPermissions(newSelected);

    try {
      const response = await fetch(`/api/v1/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds: newSelected }),
      });

      if (response.ok) {
        pushToast({
          type: "success",
          message: isSelected
            ? "Permission removed"
            : "Permission added",
        });
      } else {
        // Revert on failure
        setSelectedPermissions(selectedPermissions);
        pushToast({
          type: "error",
          message: "Failed to update permissions",
        });
      }
    } catch (error) {
      // Revert on error
      setSelectedPermissions(selectedPermissions);
      pushToast({
        type: "error",
        message: "An error occurred",
      });
    }
  };

  const paginatedUsers = paginateItems(
    role?.users ?? [],
    usersPage,
    usersPageSize,
  );

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800">Role not found</p>
          <Link href="/admin/roles" className="text-red-600 hover:text-red-800 mt-4 inline-block">
            Back to Roles
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toasts */}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-lg text-white shadow-lg ${
              toast.type === "success"
                ? "bg-green-600"
                : toast.type === "error"
                  ? "bg-red-600"
                  : "bg-blue-600"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin/roles"
            className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
          >
            ← Back to Roles
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">{role.name}</h1>
        </div>
      </div>

      {/* Role Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Role Information
        </h2>

        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role Name
            </label>
            <p className="text-gray-900 py-2 font-medium">{role.name}</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter role description"
                />
                <div className="flex gap-4">
                  <button
                    onClick={handleSaveDescription}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({ description: role.description || "" });
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <p className="text-gray-600 py-2">
                  {role.description || "No description"}
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Permissions
        </h2>

        {allPermissions.length === 0 ? (
          <p className="text-gray-600">No permissions available</p>
        ) : (
          <div className="space-y-3">
            {allPermissions.map((permission) => (
              <div key={permission.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`perm-${permission.id}`}
                  checked={selectedPermissions.includes(permission.id)}
                  onChange={() => handleTogglePermission(permission.id)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label
                  htmlFor={`perm-${permission.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <p className="font-medium text-gray-900">{permission.key}</p>
                  {permission.description && (
                    <p className="text-sm text-gray-600">
                      {permission.description}
                    </p>
                  )}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users with this Role */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Users with this Role
        </h2>

        {!role.users || role.users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No users assigned to this role</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.items.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{user.name}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-600">{user.email}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/users/${user.id}`}
                          aria-label="View user"
                          title="View user"
                          className={iconButtonClasses({ variant: "default" })}
                        >
                          <ActionIcon name="view" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ClientPaginationControls
              page={paginatedUsers.currentPage}
              totalPages={paginatedUsers.totalPages}
              pageSize={paginatedUsers.pageSize}
              totalItems={paginatedUsers.totalItems}
              itemLabel="users"
              onPageChange={setUsersPage}
              onPageSizeChange={(nextPageSize) =>
                setUsersPageSize(
                  DEFAULT_PAGE_SIZE_OPTIONS.includes(
                    nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
                  )
                    ? (nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
                    : 10,
                )
              }
            />
          </div>
        )}
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-600 text-sm mb-2">Total Users</p>
          <p className="text-3xl font-bold text-blue-600">
            {role.users?.length || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-600 text-sm mb-2">Assigned Permissions</p>
          <p className="text-3xl font-bold text-green-600">
            {selectedPermissions.length}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-600 text-sm mb-2">Available Permissions</p>
          <p className="text-3xl font-bold text-indigo-600">
            {allPermissions.length}
          </p>
        </div>
      </div>
    </div>
  );
}
