import { useState, useEffect } from "react";
import {
  LogOut,
  Clock,
  ShieldCheckIcon,
  Home,
  Building,
  UserCheck2Icon,
  TicketCheckIcon,
  FolderSync,
  LucidePackagePlus,
  BarChart3,
  Maximize,
  Minimize,
  InboxIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, NavLink } from "react-router-dom";
import { routeConfig } from "@/lib/routes";
import ShiftNavWidget from "@/components/shift/ShiftNavWidget";
import NotificationButton, {
  NotificationPrompt,
} from "@/components/NotificationButton";
import { useTicketRequests } from "@/components/ticketRequests/TicketRequestsProvider";

/** Admins: pending ticket delete / edit requests, reopens the popup */
function TicketRequestsButton({ className }: { className?: string }) {
  const { pendingCount, openRequests } = useTicketRequests();
  if (pendingCount === 0) return null;
  return (
    <button
      onClick={openRequests}
      title={`${pendingCount} demande(s) sur les tickets`}
      className={`relative flex items-center rounded-lg bg-orange-100 p-2 text-orange-600 transition-colors hover:bg-orange-50 ${className ?? ""}`}
    >
      <InboxIcon className="size-7" />
      <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
        {pendingCount}
      </span>
    </button>
  );
}

const mobileTabs: { path: string; label: string; icon: LucideIcon }[] = [
  { path: "/", label: "Accueil", icon: Home },
  { path: "/tickets", label: "Tickets", icon: TicketCheckIcon },
  { path: "/reception", label: "Réception", icon: FolderSync },
  { path: "/stats", label: "Stats", icon: BarChart3 },
  { path: "/products", label: "Produits", icon: LucidePackagePlus },
];

function Navbar() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, logout } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  // also follows Esc / F11 exits
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const tabs = mobileTabs.filter((tab) => {
    const roles = routeConfig.find((r) => r.path === tab.path)?.roles;
    return !roles || roles.includes(user?.role as string);
  });

  // NavLink with a className function: avoids the global ".active" styles in index.css
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
      isActive ? "text-primary" : "text-slate-500"
    }`;

  return (
    <>
      {/* Notifications sur mobile : popup en haut, pas de place dans la barre */}
      <NotificationPrompt />

      {/* Demandes sur les tickets (admin), sur mobile */}
      <TicketRequestsButton className="md:hidden fixed right-3 top-3 z-50 shadow-md" />

      {/* Barre de navigation mobile (bas de l'écran) */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {tabs.map((tab) => (
            <NavLink key={tab.path} to={tab.path} end className={tabClass}>
              <tab.icon className="size-5" />
              {tab.label}
            </NavLink>
          ))}
          <button
            onClick={logout}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-red-600"
          >
            <LogOut className="size-5" />
            Quitter
          </button>
        </div>
      </nav>

      <nav className="hidden md:block bg-white shadow-sm border-b py-3 sticky top-0 z-50 px-5">
        <div className="flex items-center justify-between">
          {/* Section droite avec heure, utilisateur et logout */}
          <h1 className="md:text-3xl text-xl font-medium flex items-center gap-2">
            {user?.role === "ADMIN" ? (
              <ShieldCheckIcon className="size-5 md:size-7" />
            ) : (
              <UserCheck2Icon className="size-5 md:size-7" />
            )}
            <span className="text-main font-semibold">Bonjour,</span>{" "}
            {user?.name}.
          </h1>
          <div className="flex items-center gap-6">
            {/* Informations utilisateur */}
            {user?.local && (
              <>
                <div className="hidden md:flex items-center gap-2 text-gray-600">
                  <div className="w-8 h-8 bg-main rounded-full flex items-center justify-center">
                    <Building className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {user?.local.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Connecté à {user?.local.type}
                    </div>
                  </div>
                </div>

                <div className="hidden md:block h-8 w-px bg-gray-300"></div>

                <ShiftNavWidget />

                <div className="hidden md:block h-8 w-px bg-gray-300"></div>
              </>
            )}

            <div className="hidden md:flex items-center gap-2 text-gray-600">
              <Clock className="size-6" />
              <div className="text-sm">
                <div className="font-medium">{formatTime(currentTime)}</div>
                <div className="text-xs text-gray-500 capitalize">
                  {formatDate(currentTime)}
                </div>
              </div>
            </div>

            {/* Bouton de déconnexion */}
            <section className="flex items-center flex-row-reverse gap-2">
              <NotificationButton className="order-last size-11 bg-amber-100 p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50" />
              <TicketRequestsButton />
              <button
                onClick={logout}
                className="flex items-center bg-red-100 gap-2 p-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Se déconnecter"
              >
                <LogOut className="size-7" />
              </button>
              <Link
                to="/"
                className="flex items-center bg-green-100 gap-2 p-2 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                title="Accueil"
              >
                <Home className="size-7" />
              </Link>
              {document.fullscreenEnabled && (
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center bg-slate-100 gap-2 p-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
                  title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
                >
                  {isFullscreen ? (
                    <Minimize className="size-7" />
                  ) : (
                    <Maximize className="size-7" />
                  )}
                </button>
              )}
            </section>
          </div>
        </div>
      </nav>
    </>
  );
}

export default Navbar;
