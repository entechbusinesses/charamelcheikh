import React, { useState, useEffect } from "react";
import {
  Building2,
  Search,
  Edit,
  Home,
  Building,
  LucideHome,
} from "lucide-react";
import api, { API_BASE_URL } from "@/apis/api";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import Title from "@/components/ui/Title";
import Modal from "@/components/ui/Modal";

type PDVTypes = "BELDI" | "TURKI" | "DEPOT";

interface Local {
  id: number;
  name: string;
  type: PDVTypes;
  logo_url?: string;
  _count?: { users: number };
}

interface LocalFormData {
  name: string;
  logo: any;
  type: PDVTypes;
}

const PDV_TYPES: PDVTypes[] = ["BELDI", "TURKI", "DEPOT"];

function LocalsManagement() {
  const [locals, setLocals] = useState<Local[]>([]);
  const [filteredLocals, setFilteredLocals] = useState<Local[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingLocal, setEditingLocal] = useState<Local | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("tous");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<LocalFormData>({
    name: "",
    logo: null,
    type: "BELDI",
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file.");
        return;
      }
      setFormData({ ...formData, logo: file });
    }
  };

  const fetchLocals = async () => {
    try {
      setLoading(true);
      const response = await api.get("/locals/list?count=true&depot=true");
      setLocals(response.data.data);
      setFilteredLocals(response.data.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching locals:", err);
      setError("Failed to load locals. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch locals from API
  useEffect(() => {
    fetchLocals();
  }, []);

  // Filter locals
  useEffect(() => {
    let filtered = locals;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (local) =>
          local.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          local.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== "tous") {
      filtered = filtered.filter((local) => local.type === typeFilter);
    }

    setFilteredLocals(filtered);
  }, [locals, searchTerm, typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingLocal) {
        const formData2 = new FormData();
        formData2.append("name", formData.name);
        formData2.append("type", formData.type);
        formData2.append("local_pic", formData.logo);

        await api.put(`/locals/edit/${editingLocal.id}`, formData2, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        await fetchLocals();
      } else {
        const formData2 = new FormData();
        formData2.append("name", formData.name);
        formData2.append("type", formData.type);
        formData2.append("local_pic", formData.logo);

        await api.post("/locals/add", formData2, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        await fetchLocals();
      }
      resetForm();
    } catch (err) {
      console.error("Error saving local:", err);
      alert("Failed to save local. Please try again.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      logo: null,
      type: "BELDI",
    });
    setEditingLocal(null);
    setShowModal(false);
  };

  const handleEdit = (local: Local) => {
    setEditingLocal(local);
    setFormData({
      name: local.name,
      logo: null,
      type: local.type,
    });
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingLocal(null);
    setFormData({
      name: "",
      logo: null,
      type: "BELDI",
    });
    setShowModal(true);
  };

  const getTypeBadge = (type: PDVTypes) => {
    const typeConfig = {
      BELDI: "bg-amber-100 text-amber-800 border border-amber-200",
      TURKI: "bg-purple-100 text-purple-800 border border-purple-200",
      DEPOT: "bg-red-100 text-red-800 border border-red-200",
    };
    return typeConfig[type];
  };

  const getTypeIcon = (type: PDVTypes) => {
    const iconConfig = {
      BELDI: <Home className="w-4 h-4" />,
      TURKI: <Building2 className="w-4 h-4" />,
      DEPOT: <LucideHome className="w-4 h-4" />,
    };
    return iconConfig[type];
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
    <div className="px-6 space-y-5 mt-5">
      {/* En-tête */}

      <Title
        title="Gestion des Locaux"
        description="Gérez vos locaux et leurs utilisateurs"
        Icon={Building}
        add
        btnText="Ajouter un Locale"
        onClick={handleAdd}
      />

      {/* Filters and search */}
      <div className="flex flex-col mb-5 lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un local..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
          >
            <option value="tous">Tous les types</option>
            <option value="BELDI">Beldi</option>
            <option value="TURKI">Turki</option>
            <option value="DEPOT">DEPOT</option>
          </select>
        </div>
      </div>

      {/* Locals table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Local
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateurs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLocals.map((local) => (
                <tr key={local.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img src={`${API_BASE_URL}${local.logo_url}`} />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {local.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(
                        local.type
                      )}`}
                    >
                      {getTypeIcon(local.type)}
                      {local.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {local.type !== "DEPOT" &&
                        `${local._count?.users || 0} utilisateur`}

                      {local.type !== "DEPOT" && (local._count?.users || 0) > 1
                        ? "s"
                        : ""}
                      {local.type === "DEPOT" && "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(local)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
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
          title={editingLocal ? "Modifier le local" : "Ajouter un local"}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo du local
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du local
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Magasin Principal Centre-Ville"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de point de vente
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as PDVTypes,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PDV_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choisissez le type qui correspond le mieux à votre point de
                vente
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingLocal ? "Modifier" : "Ajouter"}
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

export default LocalsManagement;
