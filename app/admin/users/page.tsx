"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  roles: Array<{
    role: {
      id: string;
      name: string;
    };
  }>;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"roles" | "delete" | "edit" | "add">(
    "roles"
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "email" | "created">("name");
  const [newUserForm, setNewUserForm] = useState({
    email: "",
    name: "",
    password: "",
    roles: [] as string[],
  });
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

  // Fetch users and roles
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersRes, rolesRes] = await Promise.all([
          fetch("/api/v1/users"),
          fetch("/api/v1/roles"),
        ]);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(Array.isArray(usersData) ? usersData : usersData.data || []);
        }

        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRoles(Array.isArray(rolesData) ? rolesData : rolesData.data || []);
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

  // Filter and sort users
  const filteredUsers = users
    .filter(
      (user) =>
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "email":
          return (a.email || "").localeCompare(b.email || "");
        case "created":
          return (
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
          );
        case "name":
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });

  const handleEditRoles = (user: User) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles.map((r) => r.role.id));
    setModalType("roles");
    setShowModal(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setModalType("delete");
    setShowModal(true);
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/v1/users/${selectedUser.id}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selectedRoles }),
      });

      if (response.ok) {
        // Update local state
        const updatedUsers = users.map((u) => {
          if (u.id === selectedUser.id) {
            return {
              ...u,
              roles: selectedRoles.map((roleId) => {
                const role = roles.find((r) => r.id === roleId);
                return { role: role! };
              }),
            };
          }
          return u;
        });
        setUsers(updatedUsers);
        setShowModal(false);
        setSelectedUser(null);
      } else {
        alert("Failed to update roles");
      }
    } catch (error) {
      console.error("Error updating roles:", error);
      alert("Error updating roles");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/v1/users/${selectedUser.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUsers(users.filter((u) => u.id !== selectedUser.id));
        setShowModal(false);
        setSelectedUser(null);
      } else {
        alert("Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Error deleting user");
    }
  };

  const handleOpenAddModal = () => {
    setNewUserForm({ email: "", name: "", password: "", roles: [] });
    setFormError("");
    setModalType("add");
    setShowModal(true);
  };

  const handleCreateUser = async () => {
    setFormError("");

    if (!newUserForm.email.trim()) {
      setFormError("Email is required");
      return;
    }

    if (!newUserForm.password.trim()) {
      setFormError("Password is required");
      return;
    }

    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserForm.email,
          name: newUserForm.name || null,
          password: newUserForm.password,
          roleIds: newUserForm.roles,
        }),
      });

      if (response.ok) {
        const newUser = await response.json();
        setUsers([...users, newUser]);
        setShowModal(false);
        setNewUserForm({ email: "", name: "", password: "", roles: [] });
      } else {
        const error = await response.json();
        setFormError(error.error || "Failed to create user");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      setFormError("Error creating user");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
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
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Manage Users</h1>
              <p className="text-blue-100 text-lg">
                Control user access, roles, and permissions
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleOpenAddModal}
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                ➕ Add User
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
        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔍 Search Users
              </label>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📊 Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "name" | "email" | "created")
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="created">Recently Created</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{filteredUsers.length}</span>{" "}
                of <span className="font-semibold">{users.length}</span> users
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Roles
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {(user.name || user.email)[0].toUpperCase()}
                          </div>
                          <div className="ml-3">
                            <p className="font-medium text-gray-900">
                              {user.name || "No name"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{user.email}</td>
                      <td className="px-6 py-4">
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
                            <span className="text-gray-500 text-sm">
                              No roles
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link href={`/admin/users/${user.id}`}> 
                            <button className="px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-sm font-medium transition-colors">
                              🔍 View
                            </button>
                          </Link>
                          <button
                            onClick={() => handleEditRoles(user)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm font-medium transition-colors"
                          >
                            🎭 Roles
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
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
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No users found</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {modalType === "roles" && selectedUser && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Edit Roles: {selectedUser.name || selectedUser.email}
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    Save Roles
                  </button>
                </div>
              </div>
            )}

            {modalType === "delete" && selectedUser && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  ⚠️ Delete User
                </h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold">
                    {selectedUser.name || selectedUser.email}
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
                    onClick={handleConfirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                  >
                    Delete User
                  </button>
                </div>
              </div>
            )}

            {modalType === "add" && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Create New User
                </h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newUserForm.email}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, email: e.target.value })
                      }
                      placeholder="user@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newUserForm.name}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, name: e.target.value })
                      }
                      placeholder="Full name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={newUserForm.password}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, password: e.target.value })
                      }
                      placeholder="Enter password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Roles
                    </label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {roles.map((role) => (
                        <label key={role.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newUserForm.roles.includes(role.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewUserForm({
                                  ...newUserForm,
                                  roles: [...newUserForm.roles, role.id],
                                });
                              } else {
                                setNewUserForm({
                                  ...newUserForm,
                                  roles: newUserForm.roles.filter((r) => r !== role.id),
                                });
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
                    </div>
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
                    onClick={handleCreateUser}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    Create User
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
