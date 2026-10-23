import api from "@/apis/api";
import { notifyError } from "@/lib/notify";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { Local, Product } from "../structure/Products";
import {
  FolderSync,
  Infinity,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Title from "@/components/ui/Title";
import { useNavigate } from "react-router-dom";

interface SelectedProductsProps {
  id: number;
  quantity: number;
  price: number;
  name: string;
}
interface FormDataProps {
  description: string;
  date: string;
  from_id: number;
  to_id: number;
  total: number;
  isBought: boolean;
}

export default function AddReception() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormDataProps>({
    description: "",
    date: new Date().toISOString(),
    from_id: 0,
    to_id: 0,
    isBought: true,
    total: 0,
  });
  const [selectedProducts, setSelectedProducts] = useState<
    SelectedProductsProps[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [locals, setLocals] = useState<Local[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingQty, setPendingQty] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter(
        (p) => p.name.toLowerCase().includes(term) || p.id.toString() === term,
      )
      .slice(0, 10);
  }, [products, search]);

  const selectProduct = (product: Product) => {
    setPendingProduct(product);
    setPendingQty("");
    setTimeout(() => qtyRef.current?.focus(), 0);
  };

  const cancelPendingProduct = () => {
    setPendingProduct(null);
    setPendingQty("");
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const addPendingProduct = () => {
    const qty = +pendingQty;
    if (!pendingProduct || !(qty > 0)) return;
    const existing = selectedProducts.find((p) => p.id === pendingProduct.id);
    AddProductQuantity(
      {
        id: pendingProduct.id,
        name: pendingProduct.name,
        price: pendingProduct.price,
        quantity: qty,
      },
      (existing?.quantity ?? 0) + qty,
    );
    setPendingProduct(null);
    setPendingQty("");
    setSearch("");
    setHighlight(0);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const AddProductQuantity = (
    product: SelectedProductsProps,
    quantity: number,
  ) => {
    const prevData = selectedProducts.filter((prod) => prod.id !== product.id);

    if (quantity === 0) {
      setSelectedProducts(prevData);
    } else {
      setSelectedProducts([
        {
          id: product.id,
          quantity: quantity,
          name: product.name,
          price: product.price,
        },
        ...prevData,
      ]);
    }
  };

  const fetchLocals = async () => {
    try {
      setLoading(true);
      const response = await api.get("/locals/list?count=true&depot=true");
      setLocals(response.data.data);
    } catch (err) {
      notifyError(err, "Impossible de charger les locaux.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const prods = await api.get(
        `/products/list?local_id=${formData.from_id}`,
      );
      setProducts(prods.data.data);
    } catch (err) {
      notifyError(err, "Impossible de charger les produits.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocals();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [formData.from_id, formData.isBought]);

  const getTotalStock = (product: Product["stock"]) => {
    return product.reduce((a, b) => a + b.quantity, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post(`/reception/add`, {
        ...formData,
        user_id: user?.id,
        products: selectedProducts,
      });

      navigate("/reception");
    } catch (error) {
      notifyError(error, "Impossible d'enregistrer le bon de réception.");
    }
  };

  useEffect(() => {
    const t = selectedProducts.reduce((a, b) => a + b.quantity * b.price, 0);
    if (selectedProducts.length > 0) {
      setFormData({
        ...formData,
        total: t,
      });
    }
  }, [selectedProducts]);

  if (loading) return <LoadingSpinning />;

  return (
    <div className="px-4 md:px-6 space-y-5">
      <Title
        title="Ajouter un Bon de Reception"
        add={false}
        Icon={FolderSync}
        description="Transferer ou Ajouer Un Stock de/vers Vos Dépôt et Locaux!"
      />

      <main className="space-y-5">
        <section className="space-y-4 md:space-y-0 md:grid grid-cols-3 gap-5 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date du Bon
            </label>
            <input
              type="datetime-local"
              value={formData.date}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  date: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: 03/08/2025"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix Total du Bon
            </label>
            <input
              type="number"
              value={formData.total.toFixed(2)}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: 50000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description du Bon
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Entrer une description à propos du Bon (optionel)"
            />
          </div>
        </section>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Envoyer De :
          </label>

          <select
            value={formData.isBought ? "bought" : formData.from_id}
            onChange={(e) =>
              setFormData({
                ...formData,
                isBought: e.target.value === "bought",
                from_id: e.target.value === "bought" ? 0 : +e.target.value,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="bought">Un Achat (Nouveau)</option>
            {locals.map((local) => (
              <option key={local.id} value={local.id}>
                {local.name} | {local.type}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            * Choisissez d'où vos produits et quantités sont envoyés!
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Envoyer à :
          </label>

          <select
            value={formData.to_id}
            onChange={(e) =>
              setFormData({
                ...formData,
                to_id: +e.target.value,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {locals.map((local) => (
              <option key={local.id} value={local.id}>
                {local.name} | {local.type}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            * Choisissez à où envoyer vos produits et quantités!
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ajouter un produit :
          </label>
          {pendingProduct ? (
            <div className="flex flex-wrap items-center gap-3 p-3 border border-blue-300 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {pendingProduct.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    Prix: {pendingProduct.price.toFixed(2)}
                    {!formData.isBought &&
                      ` | Stock: ${getTotalStock(pendingProduct.stock).toFixed(
                        2,
                      )}`}
                  </div>
                </div>
              </div>
              <input
                ref={qtyRef}
                type="number"
                min={0}
                step="any"
                value={pendingQty}
                onChange={(e) => setPendingQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPendingProduct();
                  } else if (e.key === "Escape") {
                    cancelPendingProduct();
                  }
                }}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Quantité"
              />
              <button
                onClick={addPendingProduct}
                disabled={!(+pendingQty > 0)}
                className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" /> Ajouter
              </button>
              <button
                onClick={cancelPendingProduct}
                className="flex items-center gap-2 text-gray-600 py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors"
                title="Annuler"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlight((h) =>
                      Math.min(h + 1, filteredProducts.length - 1),
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter" && filteredProducts[highlight]) {
                    e.preventDefault();
                    selectProduct(filteredProducts[highlight]);
                  } else if (e.key === "Escape") {
                    setSearch("");
                  }
                }}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Rechercher un produit par nom ou ID..."
              />
              {search.trim() && (
                <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto">
                  {filteredProducts.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-gray-500">
                      Aucun produit trouvé
                    </li>
                  ) : (
                    filteredProducts.map((product, i) => {
                      const already = selectedProducts.find(
                        (p) => p.id === product.id,
                      );
                      return (
                        <li
                          key={product.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectProduct(product);
                          }}
                          onMouseEnter={() => setHighlight(i)}
                          className={`flex items-center justify-between gap-3 px-4 py-2 cursor-pointer ${
                            i === highlight ? "bg-blue-50" : ""
                          }`}
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: #{product.id.toString().padStart(3, "0")} |
                              Prix: {product.price.toFixed(2)}
                              {already && ` | Déjà ajouté: ${already.quantity}`}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            {formData.isBought ? (
                              <Infinity className="w-4 h-4" />
                            ) : (
                              getTotalStock(product.stock).toFixed(2)
                            )}
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">
            * Recherchez un produit, cliquez dessus, entrez la quantité puis
            appuyez sur Entrée.
          </p>
        </div>

        <div className={`${selectedProducts.length === 0 && "hidden"}`}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produits à envoyer:
          </label>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="mobile-cards w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                            <Package className="w-5 h-5 text-white" />
                          </div>
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
                    <td className="px-6 py-4 whitespace-nowrap text-lg font-medium">
                      <input
                        type="number"
                        className="bg-transparent underline focus:outline-none"
                        value={product.quantity}
                        onChange={(e) =>
                          AddProductQuantity(product, +e.target.value)
                        }
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-lg font-medium">
                      {product.price.toFixed(2)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-lg font-medium">
                      {(product.price * product.quantity).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => AddProductQuantity(product, 0)}
                          className="text-red-600 flex items-center gap-3 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" /> Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={selectedProducts.length === 0 || !formData.date}
            className="flex-1 bg-blue-600 text-white disabled:opacity-50 py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ajouter Le Bon de reception!
          </button>
        </div>
      </main>
    </div>
  );
}
