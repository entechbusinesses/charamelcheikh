import { Shield, Lock } from "lucide-react";

function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          {/* Icône d'erreur */}
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-red-600" />
          </div>

          {/* Code d'erreur */}
          <div className="mb-4">
            <h1 className="text-6xl font-bold text-gray-900 mb-2">401</h1>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Accès non autorisé
            </h2>
            <p className="text-gray-600 mb-6">
              Vous n'avez pas les permissions nécessaires pour accéder à cette
              page.
            </p>
          </div>

          {/* Détails */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800 text-sm">
              <Lock className="w-4 h-4" />
              <span>Authentification requise ou permissions insuffisantes</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Actualiser la page
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full bg-blue-300 text-blue-700 py-2 px-4 rounded-lg hover:bg-blue-400 transition-colors"
            >
              Page Principale
            </button>
          </div>

          {/* Informations supplémentaires */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Si vous pensez qu'il s'agit d'une erreur, contactez votre
              administrateur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnauthorizedPage;
