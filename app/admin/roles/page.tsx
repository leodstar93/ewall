"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Role {
  id: string;
  name: string;
  description: string | null;
  _count?: {
    users: number;
    permissions: number;
  };
}

export default function AdminRolesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"add" | "delete">("add");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [formError, setFormError] = useState("");

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

  // Fetch roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/roles");

        if (response.ok) {
          const data = await response.json();
          setRoles(Array.isArray(data) ? data : data.data || []);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching roles:", error);
        setLoading(false);
      }
    };

    if (session?.user?.roles?.includes("ADMIN")) {
      fetchRoles();
    }
  }, [session]);

  const handleOpenAddModal = () => {
    setFormData({ name: "", description: "" });
    setFormError("");
    setModalType("add");
    setShowModal(true);
  };

  const handleOpenDeleteModal = (role: Role) => {
    setSelectedRole(role);
    setModalType("delete");
    setShowModal(true);
  };

  const handleAddRole = async () => {
    setFormError("");

    if (!formData.name.trim()) {
      setFormError("Role name is required");
      return;
    }

    try {
      const response = await fetch("/api/v1/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.toUpperCase(),
          description: formData.description || null,
        }),
      });

      if (response.ok) {
        const newRole = await response.json();
        setRoles([...roles, newRole]);
        setShowModal(false);
        setFormData({ name: "", description: "" });
      } else {
        const error = await response.json();
        setFormError(error.error || "Failed to create role");
      }
    } catch (error) {
      console.error("Error creating role:", error);
      setFormError("Error creating role");
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;

    try {
      const response = await fetch(`/api/v1/roles/${selectedRole.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRoles(roles.filter((r) => r.id !== selectedRole.id));
        setShowModal(false);
        setSelectedRole(null);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete role");
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      alert("Error deleting role");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading roles...</p>
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
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Manage Roles</h1>
              <p className="text-purple-100 text-lg">
                Create and manage user roles and permissions
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleOpenAddModal}
                className="bg-white text-purple-600 hover:bg-purple-50 font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                ➕ Add Role
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
            <span className="text-2xl mr-4">🎭</span>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-1">
                About Roles
              </h3>
              <p className="text-blue-700">
                Roles are used to group permissions and assign them to users.
                Create roles based on your organizational structure.
              </p>
            </div>
          </div>
        </div>

        {/* Roles Grid */}
        {roles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div
                key={role.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {role.name}
                  </h3>
                  {role.description && (
                    <p className="text-gray-600 text-sm">{role.description}</p>
                  )}
                </div>

                <div className="flex gap-3 mb-4">
                  <div className="flex-1 bg-blue-50 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {role._count?.users || 0}
                    </p>
                    <p className="text-xs text-blue-700">Users</p>
                  </div>
                  <div className="flex-1 bg-green-50 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {role._count?.permissions || 0}
                    </p>
                    <p className="text-xs text-green-700">Permissions</p>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenDeleteModal(role)}
                  disabled={
                    role.name === "ADMIN" || (role._count?.users || 0) > 0
                  }
                  className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                    role.name === "ADMIN" || (role._count?.users || 0) > 0
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-red-100 text-red-700 hover:bg-red-200"
                  }`}
                  title={
                    role.name === "ADMIN"
                      ? "Cannot delete ADMIN role"
                      : (role._count?.users || 0) > 0
                        ? "Cannot delete role with assigned users"
                        : ""
                  }
                >
                  🗑️ Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 text-lg">No roles found</p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 bg-purple-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create First Role
            </button>
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
                  Create New Role
                </h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., EDITOR, VIEWER, DOCTOR"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Name will be converted to uppercase
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
                      placeholder="Describe this role's purpose..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    onClick={handleAddRole}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
                  >
                    Create Role
                  </button>
                </div>
              </div>
            )}

            {modalType === "delete" && selectedRole && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  ⚠️ Delete Role
                </h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete the role{" "}
                  <span className="font-semibold">{selectedRole.name}</span>?
                  This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteRole}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                  >
                    Delete Role
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
