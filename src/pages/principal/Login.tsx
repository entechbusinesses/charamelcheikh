import { useCallback, useEffect, useState } from "react";
import { Delete, AlertCircle, ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

interface LoginNumpadProps {
  maxLength?: number;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function LoginNumpad({ maxLength = 10 }: LoginNumpadProps) {
  const { user, login, checkSession } = useAuth();
  const [pin, setPin] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [showError, setShowError] = useState(false);

  const addDigit = useCallback(
    (digit: string) => {
      setPin((prev) => (prev.length < maxLength ? prev + digit : prev));
      setShowError(false);
    },
    [maxLength]
  );

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setShowError(false);
  };

  const handleClear = () => {
    setPin("");
    setShowError(false);
  };

  const handleSubmit = async () => {
    if (pin.length === 0 || isValidating) return;

    setIsValidating(true);

    try {
      await login(pin);
      await checkSession();
    } catch (error) {
      setPin("");
      setShowError(true);
    } finally {
      setIsValidating(false);
    }
  };

  // Saisie au clavier physique
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isValidating) return;
      if (/^[0-9]$/.test(e.key)) addDigit(e.key);
      else if (e.key === "Backspace") handleDelete();
      else if (e.key === "Escape") handleClear();
      else if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (user) return <Navigate to="/" replace />;

  const keyClass =
    "h-14 sm:h-16 rounded-xl text-2xl font-medium text-slate-800 bg-white border border-slate-200 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="h-[100dvh] overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-visible grid lg:grid-cols-2 bg-slate-50 font-poppins">
      {/* Panneau visuel */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
        <img
          src="/hammam.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-slate-900/40" />

        <div className="relative flex items-center gap-3">
          <img src="/logos/192x192.png" alt="" className="size-10 rounded-lg" />
          <span className="text-lg font-semibold tracking-tight">
            Gestion Hammam
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Gestion des ventes, du stock et des clôtures.
          </h2>
          <p className="mt-4 text-slate-300 leading-relaxed">
            Un seul espace pour vos points de vente, vos produits, vos services
            et le suivi de fin de journée.
          </p>
        </div>

        <p className="relative text-sm text-slate-400">
          © {new Date().getFullYear()} STE EnTechnologies. Tous droits réservés.
        </p>
      </aside>

      {/* Formulaire */}
      <main className="flex items-center justify-center px-6 py-6 lg:py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:mb-8">
            <div className="inline-flex items-center justify-center size-11 rounded-xl bg-primary/10 text-primary mb-4 lg:mb-5">
              <Lock className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Connexion
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Saisissez votre code d'accès pour continuer.
            </p>
          </div>

          {/* Affichage du code (masqué) */}
          <div
            className={`h-14 rounded-xl border bg-white flex items-center justify-center gap-2.5 mb-3 transition-colors ${
              showError ? "border-red-300" : "border-slate-200"
            }`}
            aria-label={`${pin.length} chiffre(s) saisi(s)`}
          >
            {pin.length === 0 ? (
              <span className="text-sm text-slate-400">Code d'accès</span>
            ) : (
              Array.from({ length: pin.length }).map((_, i) => (
                <span key={i} className="size-2.5 rounded-full bg-slate-800" />
              ))
            )}
          </div>

          <div className="h-6 mb-3">
            {showError && (
              <p className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="size-4" />
                Code incorrect. Veuillez réessayer.
              </p>
            )}
          </div>

          {/* Clavier numérique */}
          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => addDigit(num)}
                disabled={isValidating}
                className={keyClass}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={isValidating || pin.length === 0}
              className={`${keyClass} text-sm font-medium text-slate-500`}
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={() => addDigit("0")}
              disabled={isValidating}
              className={keyClass}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isValidating || pin.length === 0}
              aria-label="Supprimer le dernier chiffre"
              className={`${keyClass} flex items-center justify-center text-slate-500`}
            >
              <Delete className="size-6" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isValidating || pin.length === 0}
            className="mt-5 lg:mt-6 w-full h-12 rounded-xl bg-slate-900 text-white font-medium flex items-center justify-center gap-2 transition-colors hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isValidating ? (
              <>
                <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Vérification…
              </>
            ) : (
              <>
                Se connecter
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          <p className="hidden lg:block mt-6 text-center text-xs text-slate-400">
            Vous pouvez aussi utiliser le clavier · Entrée pour valider
          </p>
        </div>
      </main>
    </div>
  );
}
