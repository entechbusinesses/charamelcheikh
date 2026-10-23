import { useState, useEffect, useRef } from "react";
import {
  User,
  Eye,
  Printer,
  FolderSync,
  Trash2,
  CircleDollarSign,
} from "lucide-react";
import api from "@/apis/api";
import { notifyError } from "@/lib/notify";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import { format } from "date-fns";
import { Local } from "../structure/Products";
import { useAuth } from "@/contexts/AuthContext";
import { useReactToPrint } from "react-to-print";
import PrintableReception from "./PrintReception";
import Title from "@/components/ui/Title";
import Modal from "@/components/ui/Modal";

interface User {
  id: number;
  name: string;
}

interface bons {
  id: number;
  total: number;
  from: Local;
  to: Local;
  date: string;
  description: string;
  user: User;
  isBough: boolean;
}

export default function Reception() {
  const [users, setUsers] = useState<User[]>([]);
  const [showProductsModal, setShowProductsModal] = useState<number | null>(
    null
  );

  const [dateFilterFrom, setdateFilterFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dateFilterTo, setdateFilterTo] = useState(
    new Date(new Date().setDate(new Date().getDate() + 1))
      .toISOString()
      .split("T")[0]
  );
  const { user } = useAuth();
  const [userFilter, setuserFilter] = useState<string>("tous");
  const [fromFilter, setfromFilter] = useState<string>("tous");
  const [toFilter, settoFilter] = useState<string>(
    user?.role === "ADMIN" ? "tous" : `${user?.local.id}`
  );
  const [loading, setLoading] = useState(true);
  const [LIEUX_TRAVAIL, setLIEUX_TRAVAILLE] = useState<Local[]>([]);
  const [bons, setbons] = useState<bons[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);
  const [items, setItems] = useState<
    {
      quantity: number;
      price: number;
      product: {
        id: number;
        name: string;
      };
    }[]
  >([]);
  // Inside your Reception component, add these state variables:
  const [printData, setPrintData] = useState<{
    reception: bons | null;
    items: typeof items;
  }>({
    reception: null,
    items: [],
  });

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: `
    @page {
      size: A4;
      margin: 10mm;
    }
    @media print {
      body {
        padding: 10mm;
      }
    }
  `,
  });

  const fetchDataItems = async () => {
    if (!showProductsModal) return;

    try {
      setLoadingItems(true);

      const response = await api.get(
        `/reception/items?id=${showProductsModal}`
      );
      setItems(response.data.data);
    } catch (err) {
      notifyError(err, "Impossible de charger les articles du bon.");
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchDataItems();
  }, [showProductsModal]);

  const deleteReception = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce Bon?")) return;

    try {
      setLoading(true);

      await api.delete(`/reception/remove/${id}`);
      fetchSales();
    } catch (err) {
      notifyError(err, "Impossible de supprimer ce bon de réception.");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const response = await api.get("/auth/list?type=admin");
      const lieux = await api.get("/locals/list?depot=true");

      setUsers(response.data);
      setLIEUX_TRAVAILLE(lieux.data.data);
    } catch (err) {
      notifyError(err, "Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/reception/list?user_id=${userFilter}&from_id=${fromFilter}&to_id=${toFilter}&from=${format(
          dateFilterFrom,
          "yyyy-MM-dd"
        )}&to=${format(dateFilterTo, "yyyy-MM-dd")}`
      );

      setbons(response.data.data);
    } catch (err) {
      notifyError(err, "Impossible de charger les bons de réception.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [dateFilterFrom, dateFilterTo, userFilter, fromFilter, toFilter]);

  useEffect(() => {
    fetchData();
  }, []);

  const total = bons.reduce((a, b) => a + b.total, 0);

  if (loading) {
    return <LoadingSpinning />;
  }

  const handlePrintClick = async (bonId: number) => {
    const bon = bons.find((b) => b.id === bonId);
    if (!bon) return;

    try {
      setLoadingItems(true);
      const response = await api.get(`/reception/items?id=${bonId}`);
      setPrintData({
        reception: bon,
        items: response.data.data,
      });

      // Wait for state to update then trigger print
      setTimeout(() => {
        handlePrint();
      }, 100);
    } catch (err) {
      notifyError(err, "Impossible de charger les articles à imprimer.");
    } finally {
      setLoadingItems(false);
    }
  };

  return (
    <div className="px-4 md:px-6 space-y-5">
      {/* En-tête */}

      <Title
        title="Gestion des Bon reception"
        description="Ajouter et examiner vos bons de reception"
        Icon={FolderSync}
        btnText="Ajouter reception"
        add={user?.role === "ADMIN"}
        onClick={() => (window.location.href = "/reception/add")}
      />

      {/* Filters and search */}
      <div className="flex mb-5 flex-col lg:flex-row gap-4">
        <div className="flex items-center w-full">
          De:
          <input
            type="date"
            placeholder="Rechercher un ticket..."
            value={dateFilterFrom}
            onChange={(e) => setdateFilterFrom(e.target.value)}
            className="w-full ml-2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center w-full">
          à:{" "}
          <input
            type="date"
            placeholder="Rechercher un ticket..."
            value={dateFilterTo}
            onChange={(e) => setdateFilterTo(e.target.value)}
            className="w-full ml-2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-1 md:flex-nowrap md:[&>*]:flex-none">
          <select
            value={userFilter}
            onChange={(e) => setuserFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="tous">Tous Caissiers</option>
            {users.map((value) => (
              <option value={value.id}>{value.name}</option>
            ))}
          </select>
          <select
            value={fromFilter}
            onChange={(e) => setfromFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="tous">Envoyé de Tous</option>
            {LIEUX_TRAVAIL.map((value) => (
              <option value={value.id}>
                {value.name} | {value.type}
              </option>
            ))}
          </select>
          {user?.role === "ADMIN" && (
            <select
              value={toFilter}
              onChange={(e) => settoFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="tous">Envoyé à Tous</option>
              {LIEUX_TRAVAIL.map((value) => (
                <option value={value.id}>
                  {value.name} | {value.type}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <section className="border border-blue-500 hover:text-white hover:bg-blue-500 duration-300 text-blue-500 rounded-lg p-4">
        <div className="flex gap-2 items-center">
          <CircleDollarSign />
          <h1 className="text-xl font-semibold">Total des Bons:</h1>
        </div>
        <p className="text-3xl font-bold text-end">{total.toFixed(2)} DH</p>
      </section>

      {/* Sales table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="mobile-cards w-full md:min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  # ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Envoyé De
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Envoyé à
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bons.map((bon) => (
                <tr key={bon.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {bon.id.toString().length === 1
                      ? `00${bon.id}`
                      : bon.id.toString().length === 2
                      ? `0${bon.id}`
                      : bon.id}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {bon.user.name}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {(bon.total || 0).toFixed(2)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {bon.isBough
                      ? "Achat"
                      : `${bon.from.name} | ${bon.from.type}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {`${bon.to.name} | ${bon.to.type}`}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowProductsModal(bon.id)}
                        className="flex items-center text-green-600 underline hover:text-green-900"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Voir Produit(s)
                      </button>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(bon.date, "dd/MM/yyyy HH:mm")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                    <button
                      onClick={() => handlePrintClick(bon.id)}
                      className="text-blue-600 flex items-center justify-center gap-2 hover:text-blue-900"
                    >
                      <Printer className="w-5 h-5" /> Imprimer
                    </button>
                    {user?.role === "ADMIN" && (
                      <button
                        onClick={() => deleteReception(bon.id)}
                        className="text-red-600 flex items-center justify-center gap-2 hover:text-red-900"
                      >
                        <Trash2 className="w-5 h-5" /> Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Products Modal */}
        {showProductsModal && (
          <Modal
            onClose={() => setShowProductsModal(null)}
            title="Produits vendus"
            size="xl"
          >
            {loadingItems ? (
              <LoadingSpinning inline label="Chargement des produits…" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="mobile-cards min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Nom
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Quantité
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Prix U
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map((product) => (
                        <tr key={product.product.id}>
                          <td className="px-6 py-4">
                            {product.product.name}
                          </td>

                          <td className="px-6 py-4">{product.quantity}</td>

                          <td className="px-6 py-4">
                            {product.price.toFixed(2)} DH
                          </td>

                          <td className="px-6 py-4">
                            {product.price * product.quantity} DH
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Modal>
        )}

        {bons.length === 0 && (
          <p className="text-center my-10">
            Pas de Bon de reception pour le moment, veuillez changer les
            filtres!
          </p>
        )}
      </div>

      <div style={{ display: "none" }}>
        <div ref={printRef}>
          {printData.reception && (
            <PrintableReception
              reception={printData.reception}
              items={printData.items}
            />
          )}
        </div>
      </div>
    </div>
  );
}
