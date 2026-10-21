import { useAuth } from "@/contexts/AuthContext";
import { routeConfig } from "@/lib/routes";
import {
  Building,
  Users2Icon,
  LucidePackagePlus,
  HandPlatter,
  MonitorIcon,
  TicketCheckIcon,
  FolderSync,
  Database,
  ChevronRight,
  BarChart3,
  Boxes,
  Clock,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/apis/api";

interface PageLink {
  path: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

const caissePages: PageLink[] = [
  {
    path: "/pos",
    name: "Point de vente",
    description: "Encaisser les produits et services",
    icon: MonitorIcon,
  },
  {
    path: "/cloture",
    name: "Clôture / Fin du jour",
    description: "Déclarer la caisse de la journée",
    icon: Database,
  },
  {
    path: "/shifts",
    name: "Gestion des shifts",
    description: "Shifts, fonds de caisse et tickets",
    icon: Clock,
  },
];

// caisse pages usable without a local
const noLocalPages = ["/shifts"];

const gestionPages: PageLink[] = [
  {
    path: "/stats",
    name: "Statistiques",
    description: "Recettes, bénéfices et croissance",
    icon: BarChart3,
  },
  {
    path: "/tickets",
    name: "Tickets",
    description: "Historique et détail des ventes",
    icon: TicketCheckIcon,
  },
  {
    path: "/reception",
    name: "Bons de réception",
    description: "Entrées de marchandise en stock",
    icon: FolderSync,
  },
  {
    path: "/users",
    name: "Utilisateurs",
    description: "Comptes, rôles et accès",
    icon: Users2Icon,
  },
  {
    path: "/locals",
    name: "Locaux / Dépôts",
    description: "Points de vente et entrepôts",
    icon: Building,
  },
];

const stockPages: PageLink[] = [
  {
    path: "/products",
    name: "Produits",
    description: "Catalogue, catégories et prix",
    icon: LucidePackagePlus,
  },
  {
    path: "/services",
    name: "Services",
    description: "Prestations proposées",
    icon: HandPlatter,
  },
  {
    path: "/packs",
    name: "Packs",
    description: "Service + produits à prix fixe",
    icon: Boxes,
  },
  {
    path: "/stock-shifts",
    name: "Shift stock Beldi",
    description: "Contrôle du stock des locaux BELDI",
    icon: ClipboardCheck,
  },
];

function PageCard({ page }: { page: PageLink }) {
  return (
    <Link
      to={page.path}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <page.icon className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{page.name}</p>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {page.description}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

function Section({
  title,
  pages,
  className = "",
}: {
  title: string;
  pages: PageLink[];
  className?: string;
}) {
  if (pages.length === 0) return null;
  return (
    <section className={className}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => (
          <PageCard key={page.path} page={page} />
        ))}
      </div>
    </section>
  );
}

export default function Main() {
  const { user } = useAuth();

  const isAllowed = (path: string) => {
    const roles = routeConfig.find((w) => w.path === path)?.roles;
    return !roles || roles.includes(user?.role as string);
  };

  const caisse = caissePages.filter(
    (p) =>
      isAllowed(p.path) && (!!user?.local || noLocalPages.includes(p.path)),
  );
  const gestion = gestionPages.filter((p) => isAllowed(p.path));
  const stock = stockPages.filter((p) => isAllowed(p.path));

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl flex-col px-4 md:pt-6 font-poppins md:px-2">
      {/* Logo du local de l'utilisateur (masqué si aucun local / logo) */}
      {user?.local?.logo_url && (
        <div className="flex justify-center pt-4 md:pt-0">
          <img
            src={`${API_BASE_URL}${user.local.logo_url}`}
            alt={user.local.name}
            className="h-24 md:h-32 w-auto object-contain"
          />
        </div>
      )}

      {/* Accès rapides */}
      <div className="flex-1 space-y-8 pb-6 md:py-6">
        <Section title="Caisse" pages={caisse} />
        <Section title="Gestion" pages={gestion} />
        <Section title="Stock" pages={stock} />
      </div>

      <footer className="border-t border-slate-200 py-5 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} STE EnTechnologies. Tous droits réservés.
      </footer>
    </div>
  );
}
