import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  DollarSign,
  Folder,
  List,
  Grid,
} from "lucide-react";
import api, { API_BASE_URL } from "@/apis/api";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import Modal from "@/components/ui/Modal";

interface Category {
  id: number;
  name: string;
  image_url: string | null;
}

export interface Product {
  id: number;
  image_url: string | null;
  stock: {
    quantity: number;
  }[];
  name: string;
  price: number;
  hidden: boolean;
  category_id: number;
  category?: Category;
}

interface ProductFormData {
  name: string;
  category_id: number;
  price: number;
  pic: any;
}

interface CategoryFormData {
  pic: any;
  name: string;
}

export interface Local {
  id: number;
  name: string;
  logo_url: string;
  type: "BELDI" | "TURKI" | "DEPOT";
}

function ProductsManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showModalCategory, setShowModalCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [hiddenFilter, setHiddenFilter] = useState<string>("visible");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"categories" | "products">(
    "categories"
  );
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [selectedLocal, setSelectedLocal] = useState<number>();
  const [locals, setLocals] = useState<Local[]>([]);
  const [productFormData, setProductFormData] = useState<ProductFormData>({
    name: "",
    category_id: 0,
    price: 0,
    pic: null,
  });

  const [categoryFormData, setCategoryFormData] = useState<CategoryFormData>({
    name: "",
    pic: null,
  });

  // Fetch categories from API
  const fetchCategories = async () => {
    try {
      const response = await api.get("/categories/list");
      const local = await api.get("/locals/list?depot=true");
      setCategories(response.data.data);
      setLocals(
        (local.data.data as Local[]).filter((val) => val.type !== "BELDI")
      );
    } catch (error) {
      console.error("Erreur lors de la récupération des catégories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file.");
        return;
      }
      setProductFormData({ ...productFormData, pic: file });
    }
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
      setCategoryFormData({ ...categoryFormData, pic: file });
    }
  };

  const fetchProducts = async (categoryId?: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (categoryId) {
        params.append("category_id", categoryId.toString());
      }

      if (hiddenFilter !== "tous") {
        params.append("hidden", hiddenFilter === "hidden" ? "true" : "false");
      }

      if (selectedLocal) {
        params.append("local_id", `${selectedLocal}`);
      }

      const response = await api.get(`/products/list?${params}`);
      const result = await response.data;
      setProducts(result.data);
    } catch (error) {
      console.error("Erreur lors de la récupération des produits:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (viewMode === "products" && selectedCategory) {
      fetchProducts(selectedCategory.id);
    }
  }, [hiddenFilter, selectedCategory, viewMode, selectedLocal]);

  useEffect(() => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.category?.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          product.price.toString().includes(searchTerm)
      );
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm]);

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingProduct) {
        await api.put(
          `/products/edit/${editingProduct.id}`,
          {
            name: productFormData.name,
            price: productFormData.price,
            category_id: productFormData.category_id,
            pic: productFormData.pic,
          },

          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } else {
        await api.post(
          "/products/add",
          {
            ...productFormData,
          },
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }

      await fetchProducts(selectedCategory?.id);
      resetProductForm();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert("Erreur lors de la sauvegarde du produit");
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCategory) {
        await api.put(
          `/categories/edit/${editingCategory.id}`,
          {
            name: categoryFormData.name,
            pic: categoryFormData.pic,
          },
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } else {
        await api.post(
          "/categories/add",
          {
            pic: categoryFormData.pic,
            name: categoryFormData.name,
          },
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }

      await fetchCategories();
      resetCategoryForm();
    } catch (error) {
      console.error("Erreur lors de l'ajout de la catégorie:", error);
      alert("Erreur lors de l'ajout de la catégorie");
    }
  };

  const resetProductForm = () => {
    setProductFormData({
      name: "",
      category_id: categories.length > 0 ? categories[0].id : 0,
      price: 0,
      pic: null,
    });
    setEditingProduct(null);
    setShowModal(false);
  };

  const resetCategoryForm = () => {
    setCategoryFormData({
      pic: null,
      name: "",
    });
    setEditingCategory(null);
    setShowModalCategory(false);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductFormData({
      name: product.name,
      category_id: product.category_id,
      price: product.price,
      pic: null,
    });
    setShowModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      pic: null,
    });
    setShowModalCategory(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
      try {
        await api.put(`/products/toggleHide/${id}`);
        await fetchProducts(selectedCategory?.id);
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Erreur lors de la suppression du produit");
      }
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (
      window.confirm("Êtes-vous sûr de vouloir supprimer cette catégorie ?")
    ) {
      try {
        await api.delete(`/categories/delete/${id}`);
        await fetchCategories();
        if (selectedCategory?.id === id) {
          setSelectedCategory(null);
          setViewMode("categories");
        }
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Erreur lors de la suppression de la catégorie");
      }
    }
  };

  const handleToggleHidden = async (id: number) => {
    try {
      const product = products.find((p) => p.id === id);
      if (!product) return;

      await api.put(`/products/toggleHide/${id}`, { hidden: !product.hidden });
      await fetchProducts(selectedCategory?.id);
    } catch (error) {
      console.error("Erreur lors du changement de visibilité:", error);
      alert("Erreur lors du changement de visibilité");
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "MAD",
    }).format(price);
  };

  const handleCategoryDoubleClick = (category: Category) => {
    setSelectedCategory(category);
    setViewMode("products");
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setViewMode("categories");
  };

  if (loading) return <LoadingSpinning />;

  const getTotalStock = (product: Product) => {
    return product.stock.reduce((a, b) => a + b.quantity, 0);
  };

  return (
    <div className="px-6 space-y-5 mt-5">
      {/* En-tête */}
      <div className="bg-white rounded-lg">
        <div className="flex flex-col gap-3 md:flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              {viewMode === "categories" ? (
                <List className="w-6 h-6 text-white" />
              ) : (
                <Grid className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {viewMode === "categories"
                  ? "Gestion des Catégories"
                  : `Produits de ${selectedCategory?.name || "Catégorie"}`}
              </h1>
              <p className="text-gray-600">
                {viewMode === "categories"
                  ? "Gérez vos catégories de produits"
                  : "Gérez les produits de cette catégorie"}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {viewMode === "products" && (
              <button
                onClick={handleBackToCategories}
                className="text-blue-600 border border-blue-600 px-4 py-2 rounded-lg hover:opacity-60 transition-colors flex items-center gap-2"
              >
                Retour aux catégories
              </button>
            )}
            <button
              onClick={() => {
                if (viewMode === "categories") {
                  setEditingCategory(null);
                  setShowModalCategory(true);
                } else {
                  setEditingProduct(null);
                  setShowModal(true);
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {viewMode === "categories"
                ? "Ajouter une catégorie"
                : "Ajouter un produit"}
            </button>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={
              viewMode === "categories"
                ? "Rechercher une catégorie..."
                : "Rechercher un produit..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {viewMode === "products" && (
          <select
            value={hiddenFilter}
            onChange={(e) => setHiddenFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
          >
            <option value="tous">Tous</option>
            <option value="visible">Visibles</option>
            <option value="hidden">Masqués</option>
          </select>
        )}
        {viewMode === "products" && (
          <select
            value={selectedLocal}
            onChange={(e) => setSelectedLocal(+e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
          >
            <option value="null">Tous</option>
            {locals.map((val) => (
              <option value={val.id}>
                {val.name} | {val.type}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tableau des catégories ou produits */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          {viewMode === "categories" ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catégorie
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories
                  .filter((category) =>
                    category.name
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase())
                  )
                  .map((category) => (
                    <tr
                      key={category.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onDoubleClick={() => handleCategoryDoubleClick(category)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {!category.image_url ? (
                              <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                                <Folder className="w-5 h-5 text-white" />
                              </div>
                            ) : (
                              <div className="h-10 w-10 object-contain rounded-lg bg-blue-600 flex items-center justify-center">
                                <img
                                  src={`${API_BASE_URL}${category.image_url}`}
                                />
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {category.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: #{category.id.toString().padStart(3, "0")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCategory(category);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(category.id);
                            }}
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
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
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
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {!product.image_url ? (
                            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                              <Package className="w-5 h-5 text-white" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 object-contain rounded-lg bg-blue-600 flex items-center justify-center">
                              <img
                                src={`${API_BASE_URL}${product.image_url}`}
                              />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {product.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: #{product.id.toString().padStart(3, "0")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        {formatPrice(product.price)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        {getTotalStock(product).toFixed(2) || "0.00"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          product.hidden
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : "bg-green-100 text-green-800 border border-green-200"
                        }`}
                      >
                        {product.hidden ? "Masqué" : "Visible"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleHidden(product.id)}
                          className={`p-1 rounded ${
                            product.hidden
                              ? "text-green-600 hover:text-green-900 hover:bg-green-50"
                              : "text-orange-600 hover:text-orange-900 hover:bg-orange-50"
                          }`}
                          title={product.hidden ? "Afficher" : "Masquer"}
                        >
                          {product.hidden ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
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
          )}

          {viewMode === "categories" && categories.length === 0 && (
            <div className="text-center py-12">
              <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune catégorie trouvée</p>
            </div>
          )}

          {viewMode === "products" && filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucun produit trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de création/édition de produit */}
      {showModal && (
        <Modal
          onClose={resetProductForm}
          title={editingProduct ? "Modifier le produit" : "Ajouter un produit"}
          size="lg"
        >
          <form onSubmit={handleProductSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo du produit
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du produit
              </label>
              <input
                type="text"
                value={productFormData.name}
                onChange={(e) =>
                  setProductFormData({
                    ...productFormData,
                    name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: iPhone 15 Pro"
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
                value={productFormData.price}
                onChange={(e) =>
                  setProductFormData({
                    ...productFormData,
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
                Catégorie
              </label>
              <select
                value={productFormData.category_id}
                onChange={(e) =>
                  setProductFormData({
                    ...productFormData,
                    category_id: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingProduct ? "Modifier" : "Ajouter"}
              </button>
              <button
                type="button"
                onClick={resetProductForm}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal d'ajout/édition de catégorie */}
      {showModalCategory && (
        <Modal
          onClose={resetCategoryForm}
          title={editingCategory ? "Modifier la catégorie" : "Ajouter une catégorie"}
          size="sm"
        >
          <form onSubmit={handleCategorySubmit} className="space-y-4">
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
                Nom de la catégorie
              </label>
              <input
                type="text"
                value={categoryFormData.name}
                onChange={(e) =>
                  setCategoryFormData({
                    ...categoryFormData,
                    name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Électronique"
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingCategory ? "Modifier" : "Ajouter"}
              </button>
              <button
                type="button"
                onClick={resetCategoryForm}
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

export default ProductsManagement;
