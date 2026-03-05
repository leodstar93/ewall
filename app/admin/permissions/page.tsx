"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Permission {
  id: string;
  key: string;
  description: string | null;
  roles?: Array<{ role: { id: string; name: string } }>;
  _count?: { roles: number };
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export default function AdminPermissionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<
    "add" | "delete" | "assignRoles"
  >("add");
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(
    null
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [formData, setFormData] = useState({ key: "", description: "" });
  const [formError, setFormError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Check admin access
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

  // Fetch permissions and roles
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [permRes, rolesRes] = await Promise.all([
          fetch("/api/v1/permissions"),
          fetch("/api/v1/roles"),
        ]);

        if (permRes.ok) {
          const data = await permRes.json();
          setPermissions(Array.isArray(data) ? data : data.data || []);
        }

        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoles(Array.isArray(data) ? data : data.data || []);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    if (session?.user?.roles?.includes("ADMIN")) {
      fetchData();
    }
  }, [session]);

  // Filter permissions based on search
  const filteredPermissions = permissions.filter((p) =>
    p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const handleOpenAddModal = () => {
    setFormData({ key: "", description: "" });
    setFormError("");
    setModalType("add");
    setShowModal(true);
  };

  const handleOpenAssignRolesModal = (permission: Permission) => {
    setSelectedPermission(permission);
    setSelectedRoles(
      permission.roles?.map((r) => r.role.id) || []
    );
    setModalType("assignRoles");
    setShowModal(true);
  };

  const handleOpenDeleteModal = (permission: Permission) => {
    setSelectedPermission(permission);
    setModalType("delete");
    setShowModal(true);
  };

  const handleAddPermission = async () => {
    setFormError("");

    if (!formData.key.trim()) {
      setFormError("Permission key is required");
      return;
    }

    try {
      const response = await fetch("/api/v1/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: formData.key.toLowerCase(),
          description: formData.description || null,
        }),
      });

      if (response.ok) {
        const newPermission = await response.json();
        setPermissions([...permissions, newPermission]);
        setShowModal(false);
        setFormData({ key: "", description: "" });
      } else {
        const error = await response.json();
        setFormError(error.error || "Failed to create permission");
      }
    } catch (error) {
      console.error("Error creating permission:", error);
      setFormError("Error creating permission");
    }
  };

  const handleSaveRoles = async () => {
    if (!selectedPermission) return;

    try {
      const response = await fetch(
        `/api/v1/permissions/${selectedPermission.id}/roles`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleIds: selectedRoles }),
        }
      );

      if (response.ok) {
        const updatedPermissions = permissions.map((p) => {
          if (p.id === selectedPermission.id) {
            return {
              ...p,
              roles: selectedRoles.map((roleId) => {
                const role = roles.find((r) => r.id === roleId);
                return { role: role! };
              }),
              _count: { ...p._count, roles: selectedRoles.length },
            };
          }
          return p;
        });
        setPermissions(updatedPermissions);
        setShowModal(false);
        setSelectedPermission(null);
      } else {
        alert("Failed to update roles");
      }
    } catch (error) {
      console.error("Error updating roles:", error);
      alert("Error updating roles");
    }
  };

  const handleDeletePermission = async () => {
    if (!selectedPermission) return;

    try {
      const response = await fetch(`/api/v1/permissions/${selectedPermission.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setPermissions(
          permissions.filter((p) => p.id !== selectedPermission.id)
        );
        setShowModal(false);
        setSelectedPermission(null);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete permission");
      }
    } catch (error) {
      console.error("Error deleting permission:", error);
      alert("Error deleting permission");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (!session?.user?.roles?.includes("ADMIN")) {
    return null;
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-800 text-white px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Manage Permissions</h1>
              <p className="text-orange-100 text-lg">
                Control access rights and assign to roles
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleOpenAddModal}
                className="bg-white text-orange-600 hover:bg-orange-50 font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                ➕ Add Permission
              </button>
              <Link href="/admin">
                <button className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                  ← Back to Admin
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <span className="text-2xl mr-4">🔑</span>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-1">
                About Permissions
              </h3>
              <p className="text-blue-700">
                Permissions define what actions users can perform. Create
                granular permissions and assign them to roles for fine-grained
                access control.
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="🔍 Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Permissions Table */}
        {filteredPermissions.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Permission Key
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Assigned Roles
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPermissions.map((permission) => (
                    <tr
                      key={permission.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded">
                          {permission.key}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {permission.description || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {permission.roles && permission.roles.length > 0 ? (
                            permission.roles.map((r) => (
                              <span
                                key={r.role.id}
                                className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full"
                              >
                                {r.role.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500 text-sm">
                              Not assigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenAssignRolesModal(permission)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm font-medium transition-colors"
                          >
                            🎭 Roles
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(permission)}
                            className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-medium transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 text-lg">
              {searchTerm ? "No permissions found" : "No permissions created yet"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleOpenAddModal}
                className="mt-4 bg-orange-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-orange-700 transition-colors"
              >
                Create First Permission
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {modalType === "add" && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Create New Permission
                </h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Permission Key
                    </label>
                    <input
                      type="text"
                      value={formData.key}
                      onChange={(e) =>
                        setFormData({ ...formData, key: e.target.value })
                      }
                      placeholder="e.g., cases:read, users:write"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use format: resource:action (will be converted to lowercase)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Describe what this permission allows..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  {formError && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                      {formError}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPermission}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors"
                  >
                    Create Permission
                  </button>
                </div>
              </div>
            )}

            {modalType === "assignRoles" && selectedPermission && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Assign Roles: {selectedPermission.key}
                </h3>
                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoles([...selectedRoles, role.id]);
                          } else {
                            setSelectedRoles(
                              selectedRoles.filter((r) => r !== role.id)
                            );
                          }
                        }}
                        className="w-4 h-4 text-orange-600 rounded"
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
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRoles}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors"
                  >
                    Save Roles
                  </button>
                </div>
              </div>
            )}

            {modalType === "delete" && selectedPermission && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  ⚠️ Delete Permission
                </h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete the permission{" "}
                  <span className="font-mono font-semibold">
                    {selectedPermission.key}
                  </span>
                  ? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeletePermission}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                  >
                    Delete Permission
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
