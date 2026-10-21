import React, { useState, useEffect } from "react";
import {
  Search,
  Edit,
  Ban,
  Shield,
  Calendar,
  User,
  Crown,
  CreditCard,
  Lock,
  MapPin,
  UserPlus2,
  Users2Icon,
} from "lucide-react";
import api from "@/apis/api";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import Modal from "@/components/ui/Modal";

interface Local {
  id: number;
  name: string;
  type: string;
}

interface User {
  id: number;
  name: string;
  password: string;
  role: "ADMIN" | "CAISSIER";
  createdAt: Date;
  local_id: number | null;
  banned: boolean;
  local: Local | null;
}

interface UserFormData {
  name: string;
  password: string;
  role: "ADMIN" | "CAISSIER";
  local_id: number | null;
}

function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("tous");
  const [roleFilter, setRoleFilter] = useState<string>("tous");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [LIEUX_TRAVAIL, setLIEUX_TRAVAILLE] = useState<Local[]>([]);

  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    password: "",
    role: "CAISSIER",
    local_id: null,
  });
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/auth/list?password=true");
      const lieux = await api.get("/locals/list");

      setUsers(response.data);
      setFilteredUsers(response.data);
      setLIEUX_TRAVAILLE(lieux.data.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.local?.name.toLowerCase().includes(searchTerm.toLowerCase()) ??
            false)
      );
    }

    // Status filter
    if (statusFilter !== "tous") {
      filtered = filtered.filter((user) =>
        statusFilter === "banni" ? user.banned : !user.banned
      );
    }

    // Role filter
    if (roleFilter !== "tous") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, statusFilter, roleFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUser) {
        await api.put(`/auth/edit/${editingUser.id}`, formData);

        await fetchUsers();
      } else {
        await api.post("/auth/register", formData);
        await fetchUsers();
      }
      resetForm();
    } catch (err) {
      console.error("Error saving user:", err);
      alert("Failed to save user. Please try again.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      password: "",
      role: "CAISSIER",
      local_id: null,
    });
    setEditingUser(null);
    setShowModal(false);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      password: "",
      role: user.role,
      local_id: user.local_id,
    });
    setShowModal(true);
  };

  const handleBan = async (id: number) => {
    try {
      const user = users.find((u) => u.id === id);
      if (!user) return;

      await api.put(`/auth/toggleBan/${id}`, {
        banned: !user.banned,
      });

      await fetchUsers();
    } catch (err) {
      console.error("Error updating user ban status:", err);
      alert("Failed to update user status. Please try again.");
    }
  };

  const getStatusBadge = (banned: boolean) => {
    return banned ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800";
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      ADMIN: "bg-blue-100 text-blue-800",
      CAISSIER: "bg-gray-100 text-gray-800",
    };
    return (
      roleConfig[role as keyof typeof roleConfig] || "bg-gray-100 text-gray-800"
    );
  };

  const getRoleIcon = (role: string) => {
    return role === "ADMIN" ? (
      <Crown className="w-4 h-4" />
    ) : (
      <CreditCard className="w-4 h-4" />
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("fr-FR");
  };

  const handleAdd = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      password: "",
      role: "CAISSIER",
      local_id: null,
    });
    setShowModal(true);
  };

  if (loading) {
    return <LoadingSpinning />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md">
          <div className="text-red-500 font-bold mb-4">Erreur</div>
          <p className="text-gray-700 mb-4">{error}</p>
          <p className="text-gray-500 text-sm">
            Utilisation des données de démonstration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 space-y-5">
      {/* En-tête */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Users2Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestion des Utilisateurs
              </h1>
              <p className="text-gray-600">
                Gérez vos utilisateurs et leurs lieu du tavailles
              </p>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <UserPlus2 className="w-4 h-4" />
            Ajouter un utilisateur
          </button>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex mb-5 flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="tous">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="banni">Banni</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="tous">Tous les rôles</option>
            <option value="ADMIN">Administrateur</option>
            <option value="CAISSIER">Caissier</option>
          </select>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lieu de travail
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date de création
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Mot de passe: {user.password}{" "}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(
                        user.role
                      )}`}
                    >
                      {getRoleIcon(user.role)}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {user.local?.name
                        ? `${user.local.name} | ${user.local.type}`
                        : "Non attribué"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                        user.banned
                      )}`}
                    >
                      {user.banned ? "Banni" : "Actif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDate(user.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleBan(user.id)}
                        className={`p-1 rounded ${
                          user.banned
                            ? "text-green-600 hover:text-green-900 hover:bg-green-50"
                            : "text-orange-600 hover:text-orange-900 hover:bg-orange-50"
                        }`}
                        title={user.banned ? "Débannir" : "Bannir"}
                      >
                        {user.banned ? (
                          <Shield className="w-4 h-4" />
                        ) : (
                          <Ban className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for create/edit */}
      {showModal && (
        <Modal
          onClose={resetForm}
          title={editingUser ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={
                  editingUser ? "Laisser vide pour ne pas changer" : ""
                }
                minLength={4}
                required={!editingUser}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lieu de travail
              </label>
              <select
                value={formData.local_id || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    local_id: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Non attribué</option>
                {LIEUX_TRAVAIL.map((lieu, index) => (
                  <option key={index} value={lieu.id}>
                    {lieu.name} | {lieu.type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rôle
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as "ADMIN" | "CAISSIER",
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="CAISSIER">Caissier</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingUser ? "Modifier" : "Ajouter"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Users;
