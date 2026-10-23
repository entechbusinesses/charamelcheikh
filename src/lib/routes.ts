import Main from "@/pages/principal/Main";
import Users from "@/pages/structure/Users";
import LocalsManagement from "@/pages/structure/Locals";
import UnauthorizedPage from "@/pages/404/unauthorized";
import NotFoundPage from "@/pages/404/NotFound";
import Pos from "@/pages/Pos";
import ServicesManagement from "@/pages/structure/Services";
import ProductsManagement from "@/pages/structure/Products";
import PacksManagement from "@/pages/structure/Packs";
import Tickets from "@/pages/Tickets";
import Reception from "@/pages/bon_reception/Reception";
import AddReception from "@/pages/bon_reception/AddReception";
import TotalDay from "@/pages/cloture/declaration_cloture";
import SeeAllTotalDays from "@/pages/cloture/ges_cloture";
import Stats from "@/pages/Stats";
import Shifts from "@/pages/Shifts";
import StockShifts from "@/pages/StockShifts";

export const routeConfig = [
  {
    path: "/cloture/list",
    element: SeeAllTotalDays,
    roles: ["ADMIN"],
  },
  {
    path: "/cloture",
    element: TotalDay,
    roles: ["ADMIN", "CAISSIER"],
  },
  {
    path: "/unauthorized",
    element: UnauthorizedPage,
    isPublic: true,
  },
  {
    path: "/404",
    element: NotFoundPage,
    isPublic: true,
  },
  {
    path: "/",
    element: Main,
    roles: ["ADMIN", "CAISSIER"],
  },
  {
    path: "/reception",
    element: Reception,
    roles: ["ADMIN", "CAISSIER"],
  },
  {
    path: "/reception/add",
    element: AddReception,
    roles: ["ADMIN"],
  },
  {
    path: "/stats",
    element: Stats,
    roles: ["ADMIN"],
  },
  {
    path: "/tickets",
    element: Tickets,
    roles: ["ADMIN"],
  },
  {
    path: "/users",
    element: Users,
    roles: ["ADMIN"],
  },
  {
    path: "/services",
    element: ServicesManagement,
    roles: ["ADMIN"],
  },
  {
    path: "/locals",
    element: LocalsManagement,
    roles: ["ADMIN"],
  },
  {
    path: "/locals",
    element: LocalsManagement,
    roles: ["ADMIN"],
  },
  {
    path: "/shifts",
    element: Shifts,
    roles: ["ADMIN"],
  },
  {
    path: "/stock-shifts",
    element: StockShifts,
    roles: ["ADMIN"],
  },
  {
    path: "/pos",
    element: Pos,
    roles: ["ADMIN", "CAISSIER"],
  },
  {
    path: "/products",
    element: ProductsManagement,
    roles: ["ADMIN"],
  },
  {
    path: "/packs",
    element: PacksManagement,
    roles: ["ADMIN"],
  },
];
