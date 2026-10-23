import { useState, useEffect, useRef } from "react";
import {
  User,
  TicketCheckIcon,
  Trash2,
  Eye,
  Plus,
  Minus,
  CircleDollarSign,
  BarChart3,
  Printer,
  Loader2,
  Download,
  FileText,
  ListChecks,
} from "lucide-react";
import api from "@/apis/api";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import { format } from "date-fns";
import Title from "@/components/ui/Title";
import Modal from "@/components/ui/Modal";
import {
  PAYMENT_INFO,
  PAYMENT_METHODS,
  PaymentBadge,
  saleAmounts,
  type PaymentMethod,
} from "@/lib/payment";
import { jsPDF } from "jspdf";
import { buildSalesReportPdf } from "@/lib/salesReportPdf";
import { notifyError, notifySuccess } from "@/lib/notify";
interface Local {
  id: number;
  name: string;
  type: string;
}
interface Prods {
  id: number;
  price: number;
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

interface stats {
  id: number;
  total: number;
  date: Date;
  payment_method?: PaymentMethod;
  paid_cash?: number;
  paid_tpe?: number;
  local: Local;
  user: User;
  services: {
    id: number;
    price: number;
    quantity: number;
    service: { name: string };
    frais: number;
  }[];
  products: {
    id: number;
    quantity: number;
    price: number;
    product: { name: string };
  }[];
}

export default function Tickets() {
  const [users, setUsers] = useState<User[]>([]);
  const [showProductsModal, setShowProductsModal] = useState<number | null>(
    null
  );
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState<{
    id: number;
    quantity: number;
    price: number;
    type: "product" | "service";
  }>({
    id: 0,
    type: "product",
    quantity: 1,
    price: 0,
  });

  const [dateFilterFrom, setdateFilterFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dateFilterTo, setdateFilterTo] = useState(
    new Date(new Date().setDate(new Date().getDate() + 1))
      .toISOString()
      .split("T")[0]
  );
  const [userFilter, setuserFilter] = useState<string>("tous");
  const [paymentFilter, setPaymentFilter] = useState<string>("tous");
  const [localFilter, setlocalFilter] = useState<string>("tous");
  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [LIEUX_TRAVAIL, setLIEUX_TRAVAILLE] = useState<Local[]>([]);
  const [stats, setStats] = useState<stats[]>([]);
  const [products, setProducts] = useState<Prods[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);
  // Key of the action currently running (e.g. "delete-12"), shows its spinner
  const [busy, setBusy] = useState<string | null>(null);
  const [items, setItems] = useState<
    {
      id: number;
      name: string;
      price: number;
      quantity: number;
      frais: number;
      type: "product" | "service";
      /** set when the line was sold in a pack */
      pack_name?: string | null;
    }[]
  >([]);
  const [showSalesReportModal, setShowSalesReportModal] = useState(false);
  // "Voir Rapport" first asks for the simple or the full version
  const [showReportChoice, setShowReportChoice] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const reportFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [reportPdf, setReportPdf] = useState<{
    doc: jsPDF;
    url: string;
    fileName: string;
  } | null>(null);

  const closeSalesReport = () => {
    reportFrameRef.current?.remove();
    reportFrameRef.current = null;
    if (reportPdf) URL.revokeObjectURL(reportPdf.url);
    setReportPdf(null);
    setShowSalesReportModal(false);
  };

  useEffect(() => {
    if (showAddProductModal) {
      fetchProductsServicesData();
    } else {
      setProducts([]);
    }
  }, [showAddProductModal]);

  const fetchDataItems = async (silent = false) => {
    if (!showProductsModal) return;

    try {
      if (!silent) setLoadingItems(true);

      const response = await api.get(`/sales/items/${showProductsModal}`);
      setItems(response.data.data);
    } catch (err) {
      notifyError(err, "Impossible de charger les articles du ticket.");
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchDataItems();
  }, [showProductsModal]);

  const fetchProductsServicesData = async () => {
    try {
      setLoadingItems(true);

      const prods = await api.get(
        `/sales/all_products_services?local_id=${localId}`
      );

      setProducts(prods.data.data);
    } catch (err) {
      notifyError(err, "Impossible de charger les produits et services.");
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const response = await api.get("/auth/list");
      const lieux = await api.get("/locals/list");

      setUsers(response.data);
      setLIEUX_TRAVAILLE(lieux.data.data);
    } catch (err) {
      notifyError(err, "Impossible de charger les utilisateurs et les locaux.");
    } finally {
      setLoading(false);
    }
  };

  const localId = stats.find((x) => x.id === showProductsModal)?.local.id;

  const handleAddProduct = async () => {
    if (!confirm("Êtes-vous sûr de vouloir ajouter ce produit?")) return;

    try {
      setBusy("add");
      await api.post(`/sales/add_item`, {
        id: newProduct.id,
        type: newProduct.type,
        price: newProduct.price,
        quantity: newProduct.quantity,
        stat_id: showProductsModal,
      });

      await fetchSales(true);
      await fetchDataItems(true);
    } catch (error) {
      notifyError(error, "Impossible d'ajouter cet article.");
    } finally {
      setBusy(null);
      setShowAddProductModal(false);
      setNewProduct({
        id: 0,
        type: "product",
        quantity: 1,
        price: 0,
      });
    }
  };

  const handleRemoveProduct = async (
    productId: number,
    type: "product" | "service"
  ) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

    try {
      setBusy(`remove-${type}-${productId}`);
      await api.delete(`/sales/delete_item`, {
        data: { id: productId, type },
      });

      await fetchDataItems(true);
      await fetchSales(true);
    } catch (error) {
      notifyError(error, "Impossible de supprimer cet article.");
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateQuantity = async (
    productId: number,
    type: "product" | "service",
    incordec: "inc" | "dec",
    quantity: number
  ) => {
    if (quantity === 1 && incordec === "dec") {
      handleRemoveProduct(productId, type);
      return;
    }

    if (
      !confirm("Êtes-vous sûr de vouloir modifier la quantité de ce produit ?")
    )
      return;

    try {
      setBusy(`${incordec}-${type}-${productId}`);
      await api.put(`/sales/update_quantity`, {
        id: productId,
        type,
        incordec,
      });

      await fetchDataItems(true);
      await fetchSales(true);
    } catch (error) {
      notifyError(error, "Impossible de modifier la quantité.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (statId: number) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce ticket ?")) {
      try {
        setBusy(`delete-${statId}`);
        await api.delete(`/sales/delete/${statId}`);
        // drop it right away; the refresh below brings totals back in sync
        setStats((prev) => prev.filter((s) => s.id !== statId));
        if (showProductsModal === statId) setShowProductsModal(null);
        notifySuccess(`Ticket #${statId} supprimé.`);

        await fetchSales(true);
      } catch (error) {
        notifyError(error, "Impossible de supprimer ce ticket.");
      } finally {
        setBusy(null);
      }
    }
  };

  // silent: refresh after an action without blanking the list
  const fetchSales = async (silent = false) => {
    try {
      if (!silent) {
        setLoadingSales(true);
        setStats([]);
      }
      const response = await api.get(
        `/sales/list?from=${format(dateFilterFrom, "yyyy-MM-dd")}&to=${format(
          dateFilterTo,
          "yyyy-MM-dd"
        )}&user_id=${userFilter}&local_id=${localFilter}&payment=${paymentFilter}`
      );

      setStats(response.data.data);
    } catch (err) {
      notifyError(err, "Impossible de charger les tickets.");
    } finally {
      setLoadingSales(false);
    }
  };

  const fetchSalesReportData = async (simple: boolean) => {
    try {
      setShowReportChoice(false);
      setLoadingReport(true);
      setShowSalesReportModal(true);
      const response = await api.get(
        `/sales/report?from=${format(dateFilterFrom, "yyyy-MM-dd")}&to=${format(
          dateFilterTo,
          "yyyy-MM-dd"
        )}&user_id=${userFilter}&local_id=${localFilter}&payment=${paymentFilter}`
      );

      const local = LIEUX_TRAVAIL.find((x) => x.id.toString() === localFilter);
      const doc = buildSalesReportPdf(response.data.data, {
        from: dateFilterFrom,
        to: dateFilterTo,
        caissier:
          userFilter === "tous"
            ? "Tous les caissiers"
            : users.find((u) => u.id.toString() === userFilter)?.name || "-",
        local:
          localFilter === "tous"
            ? "Tous les locaux"
            : local
            ? `${local.name} | ${local.type}`
            : "-",
        paiement:
          paymentFilter === "tous"
            ? "Tous les modes"
            : PAYMENT_INFO[paymentFilter as PaymentMethod].label,
        allLocals: localFilter === "tous",
        simple,
      });
      setReportPdf({
        doc,
        url: URL.createObjectURL(doc.output("blob")),
        fileName: `rapport-ventes${
          simple ? "-simple" : ""
        }_${dateFilterFrom}_${dateFilterTo}.pdf`,
      });
    } catch (err) {
      // close the empty report modal instead of leaving it spinning
      setShowSalesReportModal(false);
      notifyError(err, "Impossible de générer le rapport des ventes.");
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [dateFilterFrom, dateFilterTo, userFilter, localFilter, paymentFilter]);

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <LoadingSpinning />;
  }

  return (
    <div className="px-4 md:px-6 space-y-5">
      {/* En-tête */}

      <Title
        Icon={TicketCheckIcon}
        title="Gestion des Tickets (Ventes)"
        description="Modifier Vos Ticket Ou supprimer les!"
        btnText="Voir Rapport"
        btnIcon={BarChart3}
        onClick={() => setShowReportChoice(true)}
        add
      />

      {/* Filters and search */}
      <div className="flex mb-5 flex-col md:flex-row gap-4">
        <div className="flex w-full items-center">
          De:
          <input
            type="date"
            placeholder="Rechercher un ticket..."
            value={dateFilterFrom}
            onChange={(e) => setdateFilterFrom(e.target.value)}
            className="w-full ml-2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex w-full items-center">
          à:{" "}
          <input
            type="date"
            placeholder="Rechercher un ticket..."
            value={dateFilterTo}
            onChange={(e) => setdateFilterTo(e.target.value)}
            className="w-full ml-2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex mb-5 flex-col md:flex-row gap-3">
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
            value={localFilter}
            onChange={(e) => setlocalFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="tous">Tous Locaux</option>
            {LIEUX_TRAVAIL.map((value) => (
              <option value={value.id}>
                {value.name} | {value.type}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="tous">Tous Paiements</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_INFO[m].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="gap-5 grid grid-cols-1 md:grid-cols-5">
        <section className="border border-blue-500 hover:text-white hover:bg-blue-500 duration-300 text-blue-500 rounded-lg p-4">
          <div className="flex gap-2 items-center">
            <CircleDollarSign />
            <h1 className="text-xl font-semibold">CA Produits:</h1>
          </div>
          <p className="text-3xl font-bold text-end">
            {stats
              .reduce(
                (a, b) =>
                  a + b.products.reduce((a, b) => a + b.price * b.quantity, 0),
                0
              )
              .toFixed(2)}{" "}
            DH
          </p>
        </section>
        <section className="border border-blue-500 hover:text-white hover:bg-blue-500 duration-300 text-blue-500 rounded-lg p-4">
          <div className="flex gap-2 items-center">
            <CircleDollarSign />
            <h1 className="text-xl font-semibold">CA Services:</h1>
          </div>
          <p className="text-3xl font-bold text-end">
            {stats
              .reduce(
                (a, b) =>
                  a + b.services.reduce((a, b) => a + b.price * b.quantity, 0),
                0
              )
              .toFixed(2)}{" "}
            DH
          </p>
        </section>
        <section className="border border-blue-500 hover:text-white hover:bg-blue-500 duration-300 text-blue-500 rounded-lg p-4">
          <div className="flex gap-2 items-center">
            <CircleDollarSign />
            <h1 className="text-xl font-semibold">Total CA:</h1>
          </div>
          <p className="text-3xl font-bold text-end">
            {stats.reduce((a, b) => a + b.total, 0).toFixed(2)} DH
          </p>
        </section>
        <section className="border border-blue-500 hover:text-white hover:bg-blue-500 duration-300 text-blue-500 rounded-lg p-4">
          <div className="flex gap-2 items-center">
            <CircleDollarSign />
            <h1 className="text-xl font-semibold">Total Frais Kessal:</h1>
          </div>
          <p className="text-3xl font-bold text-end">
            {stats
              .reduce(
                (a, b) => a + b.services.reduce((a, b) => a + b.frais * b.quantity, 0),
                0
              )
              .toFixed(2)}{" "}
            DH
          </p>
        </section>
        <section className="border border-blue-500 hover:text-white hover:bg-blue-500 duration-300 text-blue-500 rounded-lg p-4">
          <div className="flex gap-2 items-center">
            <CircleDollarSign />
            <h1 className="text-xl font-semibold">Total NET°:</h1>
          </div>
          <p className="text-3xl font-bold text-end">
            {(
              (stats.reduce((a, b) => a + b.total, 0) || 0) -
              (stats.reduce(
                (a, b) => a + b.services.reduce((a, b) => a + b.frais * b.quantity, 0),
                0
              ) || 0)
            ).toFixed(2)}{" "}
            DH
          </p>
        </section>
      </div>

      {/* Encaissements par mode de paiement */}
      {(() => {
        const sums = { cash: 0, tpe: 0 };
        const counts = { cash: 0, tpe: 0 };
        stats.forEach((stat) => {
          const { cash, tpe } = saleAmounts(stat);
          sums.cash += cash;
          sums.tpe += tpe;
          if (cash > 0) counts.cash += 1;
          if (tpe > 0) counts.tpe += 1;
        });
        const cards = [
          {
            method: "CASH" as const,
            title: "Encaissé en Espèces",
            amount: sums.cash,
            detail: `${counts.cash} ticket(s) avec paiement en espèces`,
            style: "border-emerald-200 bg-emerald-50 text-emerald-700",
          },
          {
            method: "TPE" as const,
            title: "Encaissé par TPE",
            amount: sums.tpe,
            detail: `${counts.tpe} ticket(s) avec paiement par TPE`,
            style: "border-blue-200 bg-blue-50 text-blue-700",
          },
        ];
        return (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {cards.map(({ method, title, amount, detail, style }) => {
              const Icon = PAYMENT_INFO[method].icon;
              return (
                <section
                  key={method}
                  className={`flex items-center gap-4 rounded-lg border p-4 ${style}`}
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/70">
                    <Icon className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-2xl font-bold">{amount.toFixed(2)} DH</p>
                    <p className="truncate text-xs opacity-80">{detail}</p>
                  </div>
                </section>
              );
            })}
          </div>
        );
      })()}

      {/* Sales table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="mobile-cards w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  # ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lieu de travail
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frais Kessal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Net°
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paiement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produits/Services
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
              {stats.map((stat) => (
                <tr key={stat.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {stat.id.toString().length === 1
                      ? `00${stat.id}`
                      : stat.id.toString().length === 2
                      ? `0${stat.id}`
                      : stat.id}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {stat.user.name}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {stat.local ? (
                      `${stat.local.name} | ${stat.local.type}`
                    ) : (
                      <span className="text-gray-500">Non attribué</span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {stat.total.toFixed(2)} DH
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {stat.services
                      .reduce((a, b) => a + b.frais * b.quantity, 0)
                      .toFixed(2)}{" "}
                    DH
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(
                      stat.total -
                      stat.services.reduce((a, b) => a + b.frais * b.quantity, 0)
                    ).toFixed(2)}{" "}
                    DH
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <PaymentBadge sale={stat} />
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowProductsModal(stat.id)}
                        className="flex items-center text-green-600 underline hover:text-green-900"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {stat.products.length + stat.services.length} Produit(s)
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(stat.date, "dd/MM/yyyy HH:mm:ss")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                    <button
                      onClick={() => handleDelete(stat.id)}
                      disabled={!!busy}
                      className="text-red-600 flex items-center justify-center gap-2 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy === `delete-${stat.id}` ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />{" "}
                          Suppression...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-5 h-5" /> Supprimer
                        </>
                      )}
                    </button>

                    {/* 
                    <div className="h-6 border mx-3" />
                    <button
                      // onClick={() => handlePrint(stat.id)}
                      className="text-blue-600 flex items-center justify-center gap-2 hover:text-blue-900"
                    >
                      <Printer className="w-5 h-5" /> Imprimer
                    </button> */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Products Modal */}
        {showProductsModal && (() => {
          const ticketId = showProductsModal.toString().padStart(3, "0");
          const ticketStat = stats.find((x) => x.id === showProductsModal);
          const totalBrut = items.reduce((a, b) => a + b.price * b.quantity, 0);
          const totalKessal = items.reduce(
            (a, b) =>
              a + (b.type === "service" ? (b.frais || 0) * b.quantity : 0),
            0
          );
          const th =
            "px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider";
          const td = "px-3 py-3 whitespace-nowrap";

          const footer = (
            <div className="space-y-4">
              {!loadingItems && items.length > 0 && (
                <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
                  <div className="rounded-lg bg-gray-50 p-2 sm:p-3">
                    <p className="text-[10px] text-gray-500 uppercase sm:text-xs">Total</p>
                    <p className="text-sm font-bold sm:text-lg text-gray-900">
                      {totalBrut.toFixed(2)} DH
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 sm:p-3">
                    <p className="text-[10px] text-gray-500 uppercase sm:text-xs">Frais Kessal</p>
                    <p className="text-sm font-bold sm:text-lg text-gray-900">
                      {totalKessal.toFixed(2)} DH
                    </p>
                  </div>
                  <div className="rounded-lg bg-main/10 p-3">
                    <p className="text-xs text-main uppercase">Total Net°</p>
                    <p className="text-sm font-bold sm:text-lg text-main">
                      {(totalBrut - totalKessal).toFixed(2)} DH
                    </p>
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={!!busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-main text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                onClick={() => setShowAddProductModal(true)}
              >
                <Plus />
                Ajouter Produit/Service
              </button>
            </div>
          );

          return (
            <Modal
              onClose={() => setShowProductsModal(null)}
              title={`Ticket #${ticketId}`}
              description={
                ticketStat ? (
                  <span className="flex flex-wrap items-center gap-2">
                    Produits et services vendus · Paiement :
                    <PaymentBadge sale={ticketStat} />
                  </span>
                ) : (
                  "Produits et services vendus"
                )
              }
              size="xl"
              footer={footer}
            >
              {loadingItems ? (
                <LoadingSpinning inline label="Chargement des produits…" />
              ) : items.length === 0 ? (
                <p className="text-center my-10 text-gray-500">
                  Aucun produit ou service dans ce ticket.
                </p>
              ) : (
                <table className="mobile-cards w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={`${th} text-left rounded-l-lg`}>Nom</th>
                      <th className={`${th} text-right`}>P.U</th>
                      <th className={`${th} text-right`}>Kessal Unitaire</th>
                      <th className={`${th} text-center`}>Quantité</th>
                      <th className={`${th} text-right`}>Total</th>
                      <th className={`${th} text-center rounded-r-lg`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((product) => (
                      <tr
                        key={`${product.type}-${product.id}`}
                        className="hover:bg-gray-50"
                      >
                        <td className={`${td} text-left`}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                product.type === "service"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {product.type === "service" ? "Service" : "Produit"}
                            </span>
                            <span className="font-medium text-gray-900 whitespace-normal">
                              {product.name}
                            </span>
                            {product.pack_name && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                Pack {product.pack_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`${td} text-right`}>
                          {product.price.toFixed(2)} DH
                        </td>
                        <td className={`${td} text-right text-gray-600`}>
                          {product.type === "service"
                            ? `${(product.frais || 0).toFixed(2)} DH`
                            : "—"}
                        </td>
                        <td className={td}>
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() =>
                                handleUpdateQuantity(
                                  product.id,
                                  product.type,
                                  "dec",
                                  product.quantity
                                )
                              }
                              disabled={!!busy}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {busy === `dec-${product.type}-${product.id}` ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Minus size={18} />
                              )}
                            </button>
                            <span className="w-8 text-center font-semibold">
                              {product.quantity}
                            </span>
                            <button
                              onClick={() =>
                                handleUpdateQuantity(
                                  product.id,
                                  product.type,
                                  "inc",
                                  product.quantity
                                )
                              }
                              disabled={!!busy}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {busy === `inc-${product.type}-${product.id}` ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Plus size={18} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className={`${td} text-right font-semibold text-gray-900`}>
                          {(product.price * product.quantity).toFixed(2)} DH
                        </td>
                        <td className={`${td} text-center`}>
                          <button
                            onClick={() =>
                              handleRemoveProduct(product.id, product.type)
                            }
                            title="Supprimer"
                            disabled={!!busy}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {busy === `remove-${product.type}-${product.id}` ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Trash2 size={18} />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Modal>
          );
        })()}

        {loadingSales ? (
          <LoadingSpinning inline label="Chargement des tickets…" />
        ) : stats.length === 0 && (
          <p className="text-center my-10">
            Pas de Ticket pour le moment, veuillez changer les filtres!
          </p>
        )}

        {/* Add Product Modal */}
        {showAddProductModal && (
          <Modal
            onClose={() => setShowAddProductModal(false)}
            title="Ajouter un produit / service"
            size="sm"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddProduct();
              }}
            >
              <select
                value={`${newProduct.id}%20%${newProduct.type}%40%${newProduct.price}`}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    id: +e.target.value.split("%20%")[0],
                    type: e.target.value.split("%20%")[1].slice(0, 7) as
                      | "product"
                      | "service",
                    price: +e.target.value.split("%40%")[1],
                  })
                }
                className="px-3 py-2 border w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="tous">Tous Les produits</option>
                {products.map((value) => (
                  <option
                    value={`${value.id}%20%${value.type}%40%${value.price}`}
                  >
                    {value.type.slice(0, 1).toUpperCase()}- {value.name}
                  </option>
                ))}
              </select>

              <div className="my-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={newProduct.quantity}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      quantity: parseInt(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50"
                  onClick={() => setShowAddProductModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={busy === "add" || loadingItems || !newProduct.id}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === "add" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {busy === "add" ? "Ajout..." : "Ajouter"}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>

      {showReportChoice && (
        <Modal
          onClose={() => setShowReportChoice(false)}
          title="Rapport des Ventes"
          description="Choisissez le niveau de détail"
          size="sm"
        >
          <div className="grid gap-3">
            {[
              {
                simple: true,
                Icon: ListChecks,
                label: "Simple",
                text: "Services et produits (quantité, P.U, total) et totaux",
              },
              {
                simple: false,
                Icon: FileText,
                label: "Complet",
                text: "Détail par local, frais Kessal et modes de paiement",
              },
            ].map(({ simple, Icon, label, text }) => (
              <button
                key={label}
                type="button"
                onClick={() => fetchSalesReportData(simple)}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-main hover:bg-main/5"
              >
                <Icon className="size-6 shrink-0 text-main" />
                <span>
                  <span className="block font-semibold text-gray-900">
                    {label}
                  </span>
                  <span className="block text-sm text-gray-500">{text}</span>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showSalesReportModal && (
        <Modal
          onClose={closeSalesReport}
          title="Rapport des Ventes"
          description="Aperçu A4 — plusieurs pages si nécessaire"
          size="full"
          bodyClassName="bg-gray-100 p-2 sm:p-3 flex"
          headerActions={
            <>
              <button
                type="button"
                disabled={loadingReport || !reportPdf}
                onClick={() => reportPdf?.doc.save(reportPdf.fileName)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-main text-main font-medium hover:bg-main/10 disabled:opacity-50"
              >
                <Download className="size-5" />
                <span className="hidden sm:inline">Enregistrer PDF</span>
              </button>
              <button
                type="button"
                disabled={loadingReport || !reportPdf}
                onClick={() => {
                  if (!reportPdf) return;
                  // Print the PDF itself (all pages) through a hidden frame
                  reportFrameRef.current?.remove();
                  const frame = document.createElement("iframe");
                  frame.style.cssText =
                    "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
                  frame.src = reportPdf.url;
                  frame.onload = () => {
                    try {
                      frame.contentWindow?.focus();
                      frame.contentWindow?.print();
                    } catch {
                      window.open(reportPdf.url, "_blank");
                    }
                  };
                  document.body.appendChild(frame);
                  reportFrameRef.current = frame;
                }}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-main text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                <Printer className="size-5" />
                <span className="hidden sm:inline">Imprimer</span>
              </button>
            </>
          }
        >
          {loadingReport || !reportPdf ? (
            <div className="flex-1 flex">
              <LoadingSpinning inline label="Chargement du rapport…" />
            </div>
          ) : (
            <object
              data={reportPdf.url}
              type="application/pdf"
              title="Rapport des ventes"
              className="flex-1 w-full min-h-[70vh] rounded-lg border border-gray-300 bg-white"
            >
              <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center text-gray-600">
                <p>L'aperçu PDF n'est pas disponible dans ce navigateur.</p>
                <p>Utilisez « Enregistrer PDF » ou « Imprimer ».</p>
              </div>
            </object>
          )}
        </Modal>
      )}
    </div>
  );
}
