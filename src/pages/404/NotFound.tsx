import { AlertCircle, ArrowLeft, Home, Search } from "lucide-react";

interface NotFoundPageProps {
  onGoHome?: () => void;
  onGoBack?: () => void;
}

function NotFoundPage({ onGoHome, onGoBack }: NotFoundPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          {/* Icône d'erreur */}
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>

          {/* Code d'erreur */}
          <div className="mb-4">
            <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Page non trouvée
            </h2>
            <p className="text-gray-600 mb-6">
              La page que vous recherchez n'existe pas ou a été déplacée.
            </p>
          </div>

          {/* Détails */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-yellow-800 text-sm">
              <Search className="w-4 h-4" />
              <span>Vérifiez l'URL ou utilisez la navigation</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {onGoHome && (
              <button
                onClick={onGoHome}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Retour à l'accueil
              </button>
            )}
            {onGoBack && (
              <button
                onClick={onGoBack}
                className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Page précédente
              </button>
            )}
          </div>

          {/* Suggestions */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3">Pages disponibles :</p>
            <div className="space-y-2">
              <button
                onClick={onGoHome}
                className="block w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                → Gestion des utilisateurs
              </button>
              <button
                onClick={onGoHome}
                className="block w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                → Gestion des locaux
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
