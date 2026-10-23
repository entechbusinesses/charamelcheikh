import userRoutes from "../routes/user.routes";
import localesRoutes from "../routes/locales.routes";
import servicesRoutes from "../routes/services.routes";
import categoriesRoutes from "../routes/categories.routes";
import productRoutes from "../routes/products.routes";
import statsRoutes from "../routes/sales.routes";
import receptionRoutes from "../routes/reception.routes";
import clotureRoutes from "../routes/cloture.routes";
import packsRoutes from "../routes/packs.routes";
import notificationsRoutes from "../routes/notifications.routes";
import shiftRoutes from "../routes/shift.routes";
import stockShiftRoutes from "../routes/stockShift.routes";
import ticketRequestRoutes from "../routes/ticketRequest.routes";

export const map = [
  {
    path: "/reception",
    element: receptionRoutes,
  },
  {
    path: "/auth",
    element: userRoutes,
  },
  {
    path: "/cloture",
    element: clotureRoutes,
  },
  {
    path: "/locals",
    element: localesRoutes,
  },
  {
    path: "/categories",
    element: categoriesRoutes,
  },
  {
    path: "/services",
    element: servicesRoutes,
  },
  {
    path: "/products",
    element: productRoutes,
  },
  {
    path: "/packs",
    element: packsRoutes,
  },
  {
    path: "/notifications",
    element: notificationsRoutes,
  },
  {
    path: "/sales",
    element: statsRoutes,
  },
  {
    path: "/shifts",
    element: shiftRoutes,
  },
  {
    path: "/stock-shifts",
    element: stockShiftRoutes,
  },
  {
    path: "/ticket-requests",
    element: ticketRequestRoutes,
  },
];
