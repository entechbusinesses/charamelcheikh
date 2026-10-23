// End-to-end check of the ticket delete / edit requests, against the real
// database in server/.env:
//
//   cd server && npx ts-node tests/ticketRequests.flow.ts
//
// Creates a throwaway local, category, product, service, cashier and admin,
// runs the cashier → admin flow over HTTP, then deletes everything it created
// (even when a step fails). Push notifications are turned off for the run.
import "dotenv/config";
import crypto from "crypto";
import { AddressInfo } from "net";

// before the app is loaded: no Firebase key, so no push to the real admins
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "__no_firebase_during_tests__.json";

const { app, prisma } = require("../src/app") as typeof import("../src/app");

const TAG = `__TEST_TR__${Date.now()}`;
const STOCK = 100;

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "  ✔" : "  ✘"} ${label}`);
  if (!ok) {
    failures += 1;
    if (detail !== undefined) console.log("     →", JSON.stringify(detail));
  }
};

/** Minimal HTTP client that keeps the session cookie, like the browser */
const client = (base: string) => {
  let cookie = "";
  const sids = new Set<string>();
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      cookie = setCookie.split(";")[0];
      // connect.sid=s%3A<sid>.<signature>
      const sid = decodeURIComponent(cookie.split("=")[1]).slice(2).split(".")[0];
      sids.add(sid);
    }
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: res.status, data };
  };
  return { call, sids };
};

const ids = {
  local: 0,
  category: 0,
  product: 0,
  service: 0,
  cashier: 0,
  admin: 0,
};
const sessionIds = new Set<string>();

const setup = async () => {
  const local = await prisma.locals.create({ data: { name: `${TAG} local`, type: "TURKI" } });
  ids.local = local.id;
  const category = await prisma.categories.create({ data: { name: `${TAG} cat` } });
  ids.category = category.id;
  const product = await prisma.products.create({
    data: { name: `${TAG} produit`, price: 20, category_id: category.id },
  });
  ids.product = product.id;
  await prisma.stock.create({
    data: { product_id: product.id, local_id: local.id, quantity: STOCK },
  });
  const service = await prisma.services.create({
    data: { name: `${TAG} service`, price: 50, local_id: local.id },
  });
  ids.service = service.id;

  const cashierPassword = crypto.randomBytes(16).toString("hex");
  const adminPassword = crypto.randomBytes(16).toString("hex");
  const cashier = await prisma.user.create({
    data: { name: `${TAG} caissier`, password: cashierPassword, role: "CAISSIER", local_id: local.id },
  });
  const admin = await prisma.user.create({
    data: { name: `${TAG} admin`, password: adminPassword, role: "ADMIN" },
  });
  ids.cashier = cashier.id;
  ids.admin = admin.id;
  return { cashierPassword, adminPassword };
};

const cleanup = async () => {
  const users = [ids.cashier, ids.admin].filter(Boolean);
  await prisma.ticketRequest.deleteMany({
    where: { OR: [{ user_id: { in: users } }, { reviewer_id: { in: users } }] },
  });
  // sale lines are deleted with their sale (cascade)
  await prisma.sales.deleteMany({ where: { OR: [{ user_id: { in: users } }, { local_id: ids.local }] } });
  await prisma.shift.deleteMany({ where: { OR: [{ user_id: { in: users } }, { local_id: ids.local }] } });
  await prisma.stock.deleteMany({ where: { local_id: ids.local } });
  await prisma.pushToken.deleteMany({ where: { user_id: { in: users } } });
  if (ids.service) await prisma.services.deleteMany({ where: { id: ids.service } });
  if (ids.product) await prisma.products.deleteMany({ where: { id: ids.product } });
  if (ids.category) await prisma.categories.deleteMany({ where: { id: ids.category } });
  await prisma.session.deleteMany({
    where: { OR: [{ sid: { in: [...sessionIds] } }, { data: { contains: TAG } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  if (ids.local) await prisma.locals.deleteMany({ where: { id: ids.local } });
};

/** Rows whose name still carries the test tag (should be 0 after cleanup) */
const leftovers = async () => {
  const where = { name: { contains: "__TEST_TR__" } };
  const [locals, categories, products, services, users, sessions] = await Promise.all([
    prisma.locals.count({ where }),
    prisma.categories.count({ where }),
    prisma.products.count({ where }),
    prisma.services.count({ where }),
    prisma.user.count({ where }),
    prisma.session.count({ where: { data: { contains: "__TEST_TR__" } } }),
  ]);
  const requests = await prisma.ticketRequest.count({
    where: { user_id: { in: [ids.cashier, ids.admin] } },
  });
  return { locals, categories, products, services, users, sessions, requests };
};

const flow = async (base: string, passwords: { cashierPassword: string; adminPassword: string }) => {
  const cashier = client(base);
  const admin = client(base);

  console.log("\nCaissier");
  let r = await cashier.call("POST", "/auth/login", { password: passwords.cashierPassword });
  check("connexion caissier", r.status === 200, r);
  r = await cashier.call("POST", "/shifts/start", { fond_caisse: 100 });
  check("démarrer un shift", r.status === 201, r);
  const shiftId: number = r.data?.data?.id;

  // ticket A: 2 produits + 1 service = 90 · ticket B: 1 service = 50
  r = await cashier.call("POST", "/sales/add", {
    user_id: ids.cashier,
    total: 90,
    payment: { method: "CASH" },
    products: [{ id: ids.product, price: 20, quantity: 2 }],
    services: [{ id: ids.service, price: 50, quantity: 1 }],
  });
  check("vente A (90 DH)", r.status === 201, r);
  const saleA: number = r.data?.data?.id;
  r = await cashier.call("POST", "/sales/add", {
    user_id: ids.cashier,
    total: 50,
    payment: { method: "TPE" },
    services: [{ id: ids.service, price: 50, quantity: 1 }],
  });
  check("vente B (50 DH)", r.status === 201, r);
  const saleB: number = r.data?.data?.id;

  let stock = await prisma.stock.findFirst({ where: { product_id: ids.product, local_id: ids.local } });
  check(`stock baisse à ${STOCK - 2}`, stock?.quantity === STOCK - 2, stock?.quantity);

  r = await cashier.call("GET", `/shifts/${shiftId}/sales`);
  check("le caissier voit les tickets de son shift", r.status === 200 && r.data.data.sales.length === 2, r);
  const ticketA = r.data?.data?.sales?.find((s: any) => s.id === saleA);
  const productLine = ticketA?.lines.find((l: any) => l.type === "product");
  const serviceLine = ticketA?.lines.find((l: any) => l.type === "service");

  r = await cashier.call("POST", "/ticket-requests", {
    sale_id: saleA,
    type: "EDIT",
    reason: "test",
    changes: [
      { type: "product", id: Number(productLine.id.slice(1)), quantity: 1 },
      { type: "service", id: Number(serviceLine.id.slice(1)), quantity: 0 },
    ],
  });
  check("demande de modification A (produit 2→1, service retiré)", r.status === 201 && r.data.data.type === "EDIT", r);
  const editId: number = r.data?.data?.id;

  r = await cashier.call("POST", "/ticket-requests", { sale_id: saleA, type: "DELETE" });
  check("2e demande sur A refusée tant que la 1re attend (409)", r.status === 409, r);

  r = await cashier.call("POST", "/ticket-requests", { sale_id: saleB, type: "DELETE" });
  check("demande de suppression B", r.status === 201 && r.data.data.type === "DELETE", r);
  const deleteId: number = r.data?.data?.id;

  r = await cashier.call("POST", `/ticket-requests/${editId}/review`, { approve: true });
  check("le caissier ne peut pas valider (403)", r.status === 403, r);

  r = await cashier.call("GET", `/shifts/${shiftId}/sales`);
  check(
    "les tickets affichent « en attente »",
    r.data?.data?.sales?.every((s: any) => s.request?.status === "PENDING"),
    r.data?.data?.sales?.map((s: any) => s.request)
  );

  const unchanged = await prisma.sales.findUnique({ where: { id: saleA } });
  check("rien ne change avant validation", unchanged?.total === 90, unchanged?.total);

  console.log("\nAdmin");
  r = await admin.call("POST", "/auth/login", { password: passwords.adminPassword });
  check("connexion admin", r.status === 200, r);
  r = await admin.call("GET", "/ticket-requests?status=PENDING");
  const pendingIds = (r.data?.data ?? []).map((x: any) => x.id);
  check("l'admin voit les 2 demandes en attente", pendingIds.includes(editId) && pendingIds.includes(deleteId), pendingIds);

  r = await admin.call("POST", `/ticket-requests/${editId}/review`, { approve: true });
  check("valider la modification A", r.status === 200 && r.data.data.status === "APPROVED", r);
  const saleAfter = await prisma.sales.findUnique({
    where: { id: saleA },
    include: { products: true, services: true },
  });
  check("A : total 20 DH", saleAfter?.total === 20, saleAfter?.total);
  check("A : produit quantité 1", saleAfter?.products[0]?.quantity === 1, saleAfter?.products);
  check("A : service retiré", saleAfter?.services.length === 0, saleAfter?.services);
  check("A : paiement espèces suit le total", saleAfter?.paid_cash === 20, saleAfter?.paid_cash);
  stock = await prisma.stock.findFirst({ where: { product_id: ids.product, local_id: ids.local } });
  check(`stock remonte à ${STOCK - 1}`, stock?.quantity === STOCK - 1, stock?.quantity);

  r = await admin.call("POST", `/ticket-requests/${editId}/review`, { approve: true });
  check("valider 2 fois la même demande → 409", r.status === 409, r);

  r = await admin.call("POST", `/ticket-requests/${deleteId}/review`, { approve: true });
  check("valider la suppression B", r.status === 200 && r.data.data.status === "APPROVED", r);
  check("B supprimé", !(await prisma.sales.findUnique({ where: { id: saleB } })));
  const deleteRow = await prisma.ticketRequest.findUnique({ where: { id: deleteId } });
  check("la demande garde l'historique (ticket_id) avec sale_id vide", deleteRow?.sale_id === null && deleteRow?.ticket_id === saleB, deleteRow);

  r = await cashier.call("POST", "/ticket-requests", { sale_id: saleA, type: "DELETE", reason: "test refus" });
  check("nouvelle demande de suppression A", r.status === 201, r);
  const rejectId: number = r.data?.data?.id;
  r = await admin.call("POST", `/ticket-requests/${rejectId}/review`, { approve: false });
  check("refuser la demande", r.status === 200 && r.data.data.status === "REJECTED", r);
  check("A existe toujours après refus", !!(await prisma.sales.findUnique({ where: { id: saleA } })));

  r = await cashier.call("GET", `/shifts/${shiftId}/sales`);
  check("le caissier voit « refusée »", r.data?.data?.sales?.[0]?.request?.status === "REJECTED", r.data?.data?.sales);

  r = await cashier.call("POST", "/shifts/close", {});
  check("clôturer le shift (total 20 DH)", r.status === 200 && r.data.data.summary.total === 20, r.data?.data?.summary);

  [cashier, admin].forEach((c) => c.sids.forEach((sid) => sessionIds.add(sid)));
};

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  console.log(`Test ${TAG} sur ${base}`);

  try {
    const passwords = await setup();
    await flow(base, passwords);
  } catch (error) {
    failures += 1;
    console.error("\n✘ le test s'est arrêté :", error);
  } finally {
    // let the background notification builders finish before deleting rows
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      await cleanup();
      const left = await leftovers();
      const clean = Object.values(left).every((n) => n === 0);
      console.log(`\nNettoyage : ${clean ? "aucune trace ✔" : "RESTES ✘"}`, clean ? "" : left);
      if (!clean) failures += 1;
    } catch (error) {
      failures += 1;
      console.error("✘ nettoyage incomplet :", error);
    }
    server.close();
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} échec(s)` : "\nTout est OK ✔");
    process.exit(failures ? 1 : 0);
  }
})();
