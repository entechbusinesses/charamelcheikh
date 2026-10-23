import React, { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
  Package,
  HandPlatter,
  X,
} from "lucide-react";
import api from "@/apis/api";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import Modal from "@/components/ui/Modal";
import { notifyError } from "@/lib/notify";

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
  local_id: number;
  local?: Local;
}

interface Product {
  id: number;
  name: string;
  price: number;
}

interface Pack {
  id: number;
  name: string;
  price: number;
  hidden: boolean;
  services: { service_id: number; service: Service }[];
  products: { product_id: number; quantity: number; product: Product }[];
}

interface PackFormData {
  name: string;
  price: number;
  service_ids: number[];
  products: { product_id: number; quantity: number }[];
}

const EMPTY_FORM: PackFormData = {
  name: "",
  price: 0,
  service_ids: [],
  products: [],
};

// open-price product of the BELDI POS, never part of a pack
const TOTAL_ARTICLES = "TotalArticles";

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
  }).format(price);

const getTypeBadge = (type: PDVTypes) =>
  ({
    BELDI: "bg-amber-100 text-amber-800 border border-amber-200",
    TURKI: "bg-blue-100 text-blue-800 border border-blue-200",
  })[type];

function PacksManagement() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPack, setEditingPack] = useState<Pack | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<PackFormData>(EMPTY_FORM);
  const [productToAdd, setProductToAdd] = useState<number | "">("");
  const [serviceToAdd, setServiceToAdd] = useState<number | "">("");

  const fetchPacks = async () => {
    try {
      const response = await api.get("/packs/list?hidden=true");
      setPacks(response.data.data);
    } catch (error) {
      console.error("Erreur lors de la récupération des packs:", error);
    }
  };

  const fetchOptions = async () => {
    try {
      const [servs, prods] = await Promise.all([
        api.get("/services/list?local=true&hidden=true"),
        api.get("/products/list"),
      ]);
      setServices(servs.data.data);
      setProducts(
        (prods.data.data as Product[]).filter((p) => p.name !== TOTAL_ARTICLES),
      );
    } catch (error) {
      console.error("Erreur lors de la récupération des données:", error);
    }
  };

  useEffect(() => {
    Promise.all([fetchPacks(), fetchOptions()]).finally(() =>
      setLoading(false),
    );
  }, []);

  const filteredPacks = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return packs;
    return packs.filter(
      (pack) =>
        pack.name.toLowerCase().includes(term) ||
        pack.services.some(
          (s) =>
            s.service.name.toLowerCase().includes(term) ||
            s.service.local?.name.toLowerCase().includes(term),
        ) ||
        pack.products.some((p) => p.product.name.toLowerCase().includes(term)),
    );
  }, [packs, searchTerm]);

  const productName = (id: number) =>
    products.find((p) => p.id === id)?.name ?? `#${id}`;

  const serviceOf = (id: number) => services.find((s) => s.id === id);

  // All services of a pack come from the same local (the first one picked)
  const packLocalId = formData.service_ids.length
    ? serviceOf(formData.service_ids[0])?.local_id
    : undefined;
  const availableServices = services.filter(
    (s) =>
      !formData.service_ids.includes(s.id) &&
      (packLocalId === undefined || s.local_id === packLocalId),
  );

  // Price of the pack's content if sold separately
  const separateValue = useMemo(() => {
    return (
      formData.service_ids.reduce(
        (sum, id) => sum + (serviceOf(id)?.price || 0),
        0,
      ) +
      formData.products.reduce(
        (sum, p) =>
          sum +
          (products.find((x) => x.id === p.product_id)?.price || 0) *
            p.quantity,
        0,
      )
    );
  }, [formData, services, products]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setProductToAdd("");
    setServiceToAdd("");
    setEditingPack(null);
    setShowModal(false);
  };

  const handleEdit = (pack: Pack) => {
    setEditingPack(pack);
    setFormData({
      name: pack.name,
      price: pack.price,
      service_ids: pack.services.map((s) => s.service_id),
      products: pack.products.map((p) => ({
        product_id: p.product_id,
        quantity: p.quantity,
      })),
    });
    setShowModal(true);
  };

  const handleAddService = () => {
    if (serviceToAdd === "") return;
    setFormData({
      ...formData,
      service_ids: [...formData.service_ids, serviceToAdd],
    });
    setServiceToAdd("");
  };

  const removeService = (id: number) =>
    setFormData({
      ...formData,
      service_ids: formData.service_ids.filter((s) => s !== id),
    });

  const handleAddProduct = () => {
    if (productToAdd === "") return;
    const exists = formData.products.some((p) => p.product_id === productToAdd);
    setFormData({
      ...formData,
      products: exists
        ? formData.products.map((p) =>
            p.product_id === productToAdd
              ? { ...p, quantity: p.quantity + 1 }
              : p,
          )
        : [...formData.products, { product_id: productToAdd, quantity: 1 }],
    });
    setProductToAdd("");
  };

  const setProductQuantity = (product_id: number, quantity: number) =>
    setFormData({
      ...formData,
      products: formData.products.map((p) =>
        p.product_id === product_id
          ? { ...p, quantity: Math.max(1, quantity || 1) }
          : p,
      ),
    });

  const removeProduct = (product_id: number) =>
    setFormData({
      ...formData,
      products: formData.products.filter((p) => p.product_id !== product_id),
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      if (editingPack) {
        await api.put(`/packs/edit/${editingPack.id}`, formData);
      } else {
        await api.post("/packs/add", formData);
      }
      await fetchPacks();
      resetForm();
    } catch (error: any) {
      notifyError(error, "Erreur lors de la sauvegarde du pack");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce pack ?")) return;
    try {
      await api.delete(`/packs/delete/${id}`);
      await fetchPacks();
    } catch (error) {
      notifyError(error, "Erreur lors de la suppression du pack");
    }
  };

  const handleToggleHidden = async (pack: Pack) => {
    try {
      await api.put(`/packs/toggleHide/${pack.id}`, { hidden: !pack.hidden });
      await fetchPacks();
    } catch (error) {
      notifyError(error, "Erreur lors du changement de visibilité");
    }
  };

  if (loading) return <LoadingSpinning />;

  return (
    <div>
      {/* En-tête */}
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Boxes className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestion des Packs
              </h1>
              <p className="text-gray-600">
                Un service + des produits, vendus ensemble à un prix fixe
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 w-full md:w-max justify-center text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter un pack
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div className="px-4 md:px-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un pack, service ou produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${inputClass} pl-10 pr-4`}
          />
        </div>
      </div>

      {/* Tableau des packs */}
      <div className="rounded-lg mx-4 md:mx-6 border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="mobile-cards w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  "Pack",
                  "Service",
                  "Produits",
                  "Prix",
                  "Statut",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPacks.map((pack) => (
                <tr key={pack.id} className="hover:bg-gray-50 align-top">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {pack.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: #{pack.id.toString().padStart(3, "0")}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ul className="space-y-0.5 text-sm font-medium text-gray-900">
                      {pack.services.map((s) => (
                        <li key={s.service_id}>{s.service.name}</li>
                      ))}
                    </ul>
                    {pack.services[0]?.service.local && (
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />
                        {pack.services[0].service.local.name}
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getTypeBadge(
                            pack.services[0].service.local.type,
                          )}`}
                        >
                          {pack.services[0].service.local.type}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {pack.products.length === 0 ? (
                      <span className="text-sm text-gray-400">—</span>
                    ) : (
                      <ul className="space-y-0.5 text-sm text-gray-700">
                        {pack.products.map((p) => (
                          <li key={p.product_id}>
                            {p.quantity} × {p.product.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatPrice(pack.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        pack.hidden
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : "bg-green-100 text-green-800 border border-green-200"
                      }`}
                    >
                      {pack.hidden ? "Masqué" : "Visible"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(pack)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleHidden(pack)}
                        className={`p-1 rounded ${
                          pack.hidden
                            ? "text-green-600 hover:text-green-900 hover:bg-green-50"
                            : "text-orange-600 hover:text-orange-900 hover:bg-orange-50"
                        }`}
                        title={pack.hidden ? "Afficher" : "Masquer"}
                      >
                        {pack.hidden ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(pack.id)}
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

        {filteredPacks.length === 0 && (
          <div className="text-center py-12">
            <Boxes className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun pack trouvé</p>
          </div>
        )}
      </div>

      {/* Modal de création/édition */}
      {showModal && (
        <Modal
          onClose={resetForm}
          closeDisabled={saving}
          title={editingPack ? "Modifier le pack" : "Ajouter un pack"}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du pack
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={inputClass}
                placeholder="Ex: Pack Hammam Complet"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Services du pack
              </label>
              <div className="flex gap-2">
                <select
                  value={serviceToAdd}
                  onChange={(e) =>
                    setServiceToAdd(e.target.value ? +e.target.value : "")
                  }
                  className={inputClass}
                >
                  <option value="">Choisir un service...</option>
                  {availableServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} — {service.local?.name} (
                      {service.local?.type}) — {service.price} DH
                      {service.hidden ? " [masqué]" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddService}
                  disabled={serviceToAdd === ""}
                  className="shrink-0 bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
              </div>

              <div className="mt-2 border border-gray-300 rounded-lg divide-y">
                {formData.service_ids.length === 0 ? (
                  <p className="p-3 text-sm text-gray-400 text-center">
                    Aucun service dans ce pack
                  </p>
                ) : (
                  formData.service_ids.map((id) => (
                    <div key={id} className="flex items-center gap-3 px-3 py-2">
                      <HandPlatter className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="flex-1 text-sm text-gray-900 truncate">
                        {serviceOf(id)?.name ?? `#${id}`}
                      </span>
                      <span className="text-sm text-gray-500">
                        {serviceOf(id)?.price ?? 0} DH
                      </span>
                      <button
                        type="button"
                        onClick={() => removeService(id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                        title="Retirer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {packLocalId !== undefined
                  ? `Services du local ${
                      serviceOf(formData.service_ids[0])?.local?.name ?? ""
                    } uniquement : le pack est proposé dans sa caisse.`
                  : "Le pack est proposé dans la caisse du local de ses services."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Produits du pack
              </label>
              <div className="flex gap-2">
                <select
                  value={productToAdd}
                  onChange={(e) =>
                    setProductToAdd(e.target.value ? +e.target.value : "")
                  }
                  className={inputClass}
                >
                  <option value="">Choisir un produit...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} — {product.price} DH
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={productToAdd === ""}
                  className="shrink-0 bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
              </div>

              <div className="mt-2 border border-gray-300 rounded-lg divide-y">
                {formData.products.length === 0 ? (
                  <p className="p-3 text-sm text-gray-400 text-center">
                    Aucun produit dans ce pack
                  </p>
                ) : (
                  formData.products.map((p) => (
                    <div
                      key={p.product_id}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <Package className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="flex-1 text-sm text-gray-900 truncate">
                        {productName(p.product_id)}
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={p.quantity}
                        onChange={(e) =>
                          setProductQuantity(p.product_id, +e.target.value)
                        }
                        className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                        title="Quantité"
                      />
                      <button
                        type="button"
                        onClick={() => removeProduct(p.product_id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                        title="Retirer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix du pack (MAD)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: Math.round(+e.target.value) || 0,
                  })
                }
                className={inputClass}
                required
              />
              {formData.service_ids.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Prix à l'unité du contenu : {formatPrice(separateValue)}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving || formData.service_ids.length === 0}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Enregistrement..."
                  : editingPack
                    ? "Modifier"
                    : "Ajouter"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
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

export default PacksManagement;
