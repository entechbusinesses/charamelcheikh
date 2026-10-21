import { useState, useEffect } from "react";
import { User, CalendarClock, DollarSign, FileEdit, ArrowLeft } from "lucide-react";
import api from "@/apis/api";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import Title from "@/components/ui/Title";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
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

interface Cloture {
  id: number;
  total: number;
  total_services: number;
  total_products: number;
  date: Date;
  local: Local;
  user: User;
}

export default function SeeAllTotalDays() {
  const [users, setUsers] = useState<User[]>([]);
  const [dateFilter, setdateFilter] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [userFilter, setuserFilter] = useState<string>("tous");
  const [localFilter, setlocalFilter] = useState<string>("tous");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [LIEUX_TRAVAIL, setLIEUX_TRAVAILLE] = useState<Local[]>([]);
  const [cloture, setCloture] = useState<Cloture[]>([]);
  const navigate = useNavigate();
  const [open, setOpen] = useState<Cloture | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      const users = await api.get("/auth/list");
      const lieux = await api.get("/locals/list");
      const data = await api.get(
        `/cloture/list?day=${dateFilter}&local_id=${localFilter}&user_id=${userFilter}`
      );

      setUsers(users.data);
      setLIEUX_TRAVAILLE(lieux.data.data);
      setCloture(data.data.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const editData = async () => {
    try {
      await api.put("/cloture/update", {
        ...open,
      });
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again later.");
    } finally {
      setLoading(false);
      fetchData();
      setOpen(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter, userFilter, localFilter]);

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
      {/* Header */}
      <Title
        title="Déclaration Montant de Fin de journée"
        description="Déclarez vos montants de produits, service et total ici!"
        Icon={DollarSign}
        add
        onClick={() => navigate("/cloture")}
        btnText="Retournez"
        btnIcon={ArrowLeft}
      />

      {/* Filters and search */}
      <div className="flex mb-5 flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <CalendarClock className="absolute left-3 top-3 size-5 text-gray-400" />
          <input
            type="date"
            placeholder="Rechercher un ticket..."
            value={dateFilter}
            onChange={(e) => setdateFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-3">
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
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Local
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Caissier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total CA Services
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total CA Produits
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total CA
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {cloture.map((value) => (
              <tr key={value.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(value.date).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {value.local.name} | {value.local.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {value.user.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {value.total_services.toFixed(2)} DH
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {value.total_products.toFixed(2)} DH
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {value.total.toFixed(2)} DH
                </td>
                <td
                  onClick={() => setOpen(value)}
                  className="p-1.5 w-max bg-yellow-50 font-medium justify-center my-3 gap-3 text-yellow-500 rounded-lg cursor-pointer flex items-center"
                >
                  <FileEdit className="size-5" /> Modifier
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {cloture.length === 0 && (
          <p className="text-center my-10">
            Pas de cloture pour le moment, veuillez changer les filtres!
          </p>
        )}
      </div>

      {open && (
        <Modal
          onClose={() => setOpen(null)}
          title={`Modifier Totaux de ${format(open.date, "P")}:`}
          size="lg"
          closeDisabled={loading}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              editData();
            }}
          >
            <div className="grid md:grid-cols-3 gap-6">
              {/* Products Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chiffre d'Affaires Produits
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">MAD</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={open.total_products}
                    onChange={(e) =>
                      setOpen({
                        ...open,
                        total_products: Number(e.target.value),
                      })
                    }
                    placeholder="0,00"
                    className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Services Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chiffre d'Affaires Services
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">MAD</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={open.total_services}
                    onChange={(e) =>
                      setOpen({
                        ...open,
                        total_services: Number(e.target.value),
                      })
                    }
                    placeholder="0,00"
                    className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Total Revenue Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chiffre d'Affaires Total
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">MAD</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={open.total}
                    onChange={(e) =>
                      setOpen({
                        ...open,
                        total: Number(e.target.value),
                      })
                    }
                    placeholder="0,00"
                    className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 flex gap-5 justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => setOpen(null)}
                className="hover:bg-main text-main border border-main hover:text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={loading}
                className="bg-main hover:bg-main disabled:bg-gray-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Enregistrer les Totaux Journaliers
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
