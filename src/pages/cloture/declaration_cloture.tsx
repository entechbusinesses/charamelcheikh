"use client";

import api from "@/apis/api";
import { notifyError } from "@/lib/notify";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Local } from "../structure/Products";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import Title from "@/components/ui/Title";
import { DollarSign, List as ListIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TotalDayProps {
  day: string;
  local_id: number;
  local: Local;
  total: number;
  total_products: number;
  total_services: number;
}

export default function TotalDay() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TotalDayProps | null>(null);
  const { user } = useAuth();
  const localId = user?.local?.id;
  const navigate = useNavigate();
  const [totalDay, setTotalDay] = useState<{
    total: number;
    total_products: number;
    total_services: number;
  }>({
    total: 0,
    total_products: 0,
    total_services: 0,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/cloture?day=${
          new Date().toISOString().split("T")[0]
        }&local_id=${localId}`
      );
      setData(response.data.data);
    } catch (err) {
      notifyError(err, "Échec du chargement des données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [localId]);

  const handleAddTotalDay = async () => {
    try {
      setLoading(true);
      await api.post("/cloture/add", {
        day: new Date().toISOString().split("T")[0],
        local_id: +(localId as number),
        user_id: +(user?.id as number),
        total: totalDay.total,
        total_products: totalDay.total_products,
        total_services: totalDay.total_services,
      });
    } catch (err) {
      notifyError(err, "Échec de l'ajout du total journalier.");
    } finally {
      fetchData();
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "MAD",
    }).format(amount);
  };

  if (loading) {
    return <LoadingSpinning label="Chargement des totaux journaliers…" />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <Title
        title="Déclaration Montant de Fin de journée"
        description="Déclarez vos montants de produits, service et total ici!"
        Icon={DollarSign}
        onClick={() => navigate("list")}
        add={user?.role === "ADMIN"}
        btnText="Voir les Totaux Journaliers"
        btnIcon={ListIcon}
      />

      {data ? (
        /* Display Existing Data */
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-main px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Journée Terminée
            </h2>
            <p className="text-gray-300 mt-1">
              Vos totaux journaliers ont été enregistrés
            </p>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Total Revenue */}
              <div className="bg-gray-100 border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">
                      Chiffre d'Affaires Total
                    </p>
                    <p className="text-2xl font-semibold text-gray-800 mt-1">
                      {formatCurrency(data.total)}
                    </p>
                  </div>
                  <div className="bg-gray-200 rounded-full p-3">
                    <svg
                      className="w-6 h-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Products */}
              <div className="bg-gray-100 border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">
                      CA Produits
                    </p>
                    <p className="text-2xl font-semibold text-gray-800 mt-1">
                      {formatCurrency(data.total_products)}
                    </p>
                  </div>
                  <div className="bg-gray-200 rounded-full p-3">
                    <svg
                      className="w-6 h-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div className="bg-gray-100 border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">
                      CA Services
                    </p>
                    <p className="text-2xl font-semibold text-gray-800 mt-1">
                      {formatCurrency(data.total_services)}
                    </p>
                  </div>
                  <div className="bg-gray-200 rounded-full p-3">
                    <svg
                      className="w-6 h-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Input Form */
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-main px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
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
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              Enregistrer les Totaux Journaliers
            </h2>
            <p className="text-gray-300 mt-1">
              Saisissez votre résumé des ventes journalières
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTotalDay();
            }}
            className="p-6"
          >
            <div className="grid md:grid-cols-3 gap-6">
              {/* Total Revenue Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chiffre d'Affaires Total
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-sm font-medium text-gray-500">MAD</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={totalDay.total}
                    onChange={(e) =>
                      setTotalDay({
                        ...totalDay,
                        total: Number(e.target.value),
                      })
                    }
                    placeholder="0,00"
                    className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Products Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chiffre d'Affaires Produits
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-sm font-medium text-gray-500">MAD</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={totalDay.total_products}
                    onChange={(e) =>
                      setTotalDay({
                        ...totalDay,
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
                    <span className="text-sm font-medium text-gray-500">MAD</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={totalDay.total_services}
                    onChange={(e) =>
                      setTotalDay({
                        ...totalDay,
                        total_services: Number(e.target.value),
                      })
                    }
                    placeholder="0,00"
                    className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            {/* Summary Preview */}
            <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Aperçu du Résumé
              </h3>
              <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
                <div>
                  <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {formatCurrency(totalDay.total)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Produits</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {formatCurrency(totalDay.total_products)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Services</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {formatCurrency(totalDay.total_services)}
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 flex justify-center">
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
        </div>
      )}
    </div>
  );
}
