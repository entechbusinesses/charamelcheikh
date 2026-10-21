import React, { useState, useEffect } from "react";
import {
  Settings,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  DollarSign,
  MapPin,
  Building2,
  Tag,
} from "lucide-react";
import api, { API_BASE_URL } from "@/apis/api";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import Modal from "@/components/ui/Modal";

type PDVTypes = "BELDI" | "TURKI";

interface Local {
  id: number;
  name: string;
  type: PDVTypes;
}

interface Service {
  id: number;
  name: string;
  price: number;
  hidden: boolean;
  pic: string | null;
  local_id: number;
  frais: number;
  image_url: string | null;
  local?: Local;
}

interface ServiceFormData {
  name: string;
  locals_id: number[];
  pic: any;
  price: number;
  frais: number;
}

function ServicesManagement() {
  const [services, setServices] = useState<Service[]>([]);
  const [locals, setLocals] = useState<Local[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("tous");
  const [hiddenFilter, setHiddenFilter] = useState<string>("visible");
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<ServiceFormData>({
    pic: null,
    name: "",
    locals_id: [],
    price: 0,
    frais: 0,
  });

  const fetchLocals = async () => {
    try {
      const response = await api.get("/locals/list");

      setLocals(response.data.data);
    } catch (error) {
      console.error("Erreur lors de la récupération des locaux:", error);
    }
  };

  const fetchServices = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (typeFilter !== "tous") {
        params.append("type", typeFilter);
      }

      if (hiddenFilter !== "tous") {
        params.append("hidden", hiddenFilter === "hidden" ? "false" : "true");
      }

      const response = await api.get(
        `/services/list?local=true&hidden=${hiddenFilter === "tous"}${
          typeFilter !== "tous" ? `&type=${typeFilter}` : ""
        }`
      );

      setServices(response.data.data);
    } catch (error) {
      console.error("Erreur lors de la récupération des services:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocals();
  }, []);

  useEffect(() => {
    fetchServices();
  }, [typeFilter, hiddenFilter]);

  useEffect(() => {
    let filtered = services;

    if (searchTerm) {
      filtered = filtered.filter(
        (service) =>
          service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          service.local?.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          service.price.toString().includes(searchTerm)
      );
    }

    setFilteredServices(filtered);
  }, [services, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingService) {
        await api.put(
          `/services/edit/${editingService.id}`,
          {
            name: formData.name,
            price: formData.price,
            frais: formData.frais,
            pic: formData.pic,
          },
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        await fetchServices();
      } else {
        await api.post(
          "/services/add",
          {
            ...formData,
          },

          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        await fetchServices();
      }

      resetForm();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert("Erreur lors de la sauvegarde du service");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      pic: null,
      locals_id: [],
      price: 0,
      frais: 0,
    });
    setEditingService(null);
    setShowModal(false);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      pic: service.pic,
      name: service.name,
      locals_id: [service.local_id],
      price: service.price,
      frais: service.frais,
    });
    setShowModal(true);
  };

  const handleFileChangeCategory = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file.");
        return;
      }
      setFormData({ ...formData, pic: file });
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce service ?")) {
      try {
        await api.delete(`/services/delete/${id}`);

        await fetchServices();
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Erreur lors de la suppression du service");
      }
    }
  };

  const handleToggleHidden = async (id: number) => {
    try {
      const service = services.find((s) => s.id === id);
      if (!service) return;

      await api.put(`/services/toggleHide/${id}`, {
        hidden: !service.hidden,
      });

      await fetchServices();
    } catch (error) {
      console.error("Erreur lors du changement de visibilité:", error);
      alert("Erreur lors du changement de visibilité");
    }
  };

  const handleLocalSelection = (localId: number) => {
    const isSelected = formData.locals_id.includes(localId);
    if (isSelected) {
      setFormData({
        ...formData,
        locals_id: formData.locals_id.filter((id) => id !== localId),
      });
    } else {
      setFormData({
        ...formData,
        locals_id: [...formData.locals_id, localId],
      });
    }
  };

  const handleSelectAllLocals = () => {
    const allLocalIds = locals.map((local) => local.id);
    const isAllSelected = allLocalIds.every((id) =>
      formData.locals_id.includes(id)
    );

    if (isAllSelected) {
      setFormData({ ...formData, locals_id: [] });
    } else {
      setFormData({ ...formData, locals_id: allLocalIds });
    }
  };

  const getTypeBadge = (type: PDVTypes) => {
    const typeConfig = {
      BELDI: "bg-amber-100 text-amber-800 border border-amber-200",
      TURKI: "bg-blue-100 text-blue-800 border border-blue-200",
    };
    return typeConfig[type];
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "MAD",
    }).format(price);
  };

  if (loading) return <LoadingSpinning />;

  return (
    <div>
      {/* En-tête */}
      <div className="p-6">
        <div className="flex flex-col gap-3 md:flex-row items-center justify-between">
          <div className="flex  items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestion des Services
              </h1>
              <p className="text-gray-600">
                Gérez les services disponibles dans vos locaux
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 w-full md:w-max justify-center text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter un service
          </button>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="px-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
            >
              <option value="tous">Tous les types</option>
              <option value="BELDI">Beldi</option>
              <option value="TURKI">Turki</option>
            </select>
            <select
              value={hiddenFilter}
              onChange={(e) => setHiddenFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
            >
              <option value="tous">Tous</option>
              <option value="visible">Visibles</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau des services */}
      <div className="rounded-lg mx-6 border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frais Kessal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Local
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {!service.image_url ? (
                          <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                            <Tag className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 object-contain rounded-lg bg-blue-600 flex items-center justify-center">
                            <img src={`${API_BASE_URL}${service.image_url}`} />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {service.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: #{service.id.toString().padStart(3, "0")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      {formatPrice(service.price)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      {formatPrice(service.frais)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {service.local?.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {service.local && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(
                          service.local.type
                        )}`}
                      >
                        <Building2 className="w-3 h-3" />
                        {service.local.type}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        service.hidden
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : "bg-green-100 text-green-800 border border-green-200"
                      }`}
                    >
                      {service.hidden ? "Masqué" : "Visible"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(service)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleHidden(service.id)}
                        className={`p-1 rounded ${
                          service.hidden
                            ? "text-green-600 hover:text-green-900 hover:bg-green-50"
                            : "text-orange-600 hover:text-orange-900 hover:bg-orange-50"
                        }`}
                        title={service.hidden ? "Afficher" : "Masquer"}
                      >
                        {service.hidden ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(service.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun service trouvé</p>
          </div>
        )}
      </div>

      {/* Modal de création/édition */}
      {showModal && (
        <Modal
          onClose={resetForm}
          title={editingService ? "Modifier le service" : "Ajouter un service"}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo du produit
              </label>
              <input
                type="file"
                onChange={handleFileChangeCategory}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du service
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Consultation médicale"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix (MAD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frais Kessal (MAD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.frais}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    frais: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                required
              />
            </div>

            {!editingService && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Locaux où proposer ce service
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllLocals}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {locals.every((local) =>
                      formData.locals_id.includes(local.id)
                    )
                      ? "Désélectionner tout"
                      : "Tous les locaux"}
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {locals.map((local) => (
                    <label
                      key={local.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.locals_id.includes(local.id)}
                        onChange={() => handleLocalSelection(local.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900">
                        {local.name}
                      </span>
                      <span
                        className={`ml-auto px-2 py-1 text-xs rounded-full ${getTypeBadge(
                          local.type
                        )}`}
                      >
                        {local.type}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Sélectionnez un ou plusieurs locaux
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={!editingService && formData.locals_id.length === 0}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {editingService ? "Modifier" : "Ajouter"}
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

export default ServicesManagement;
