# Charam El Cheikh — Hammam POS & Management

A point-of-sale and back-office app for a hammam business (multiple points of sale: *Beldi*, *Turki*, and a *Dépôt* warehouse). It handles sales tickets, products and services, stock per location, goods receptions, daily closing ("clôture"), and user management.

- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, shadcn/Radix UI, Ant Design, React Query, i18next (French), Chart.js/Recharts. Installable as a PWA (`public/manifest.json`, `serviceworker.js`).
- **Backend:** Node.js + Express + TypeScript (`server/`), Prisma ORM on MySQL, session auth stored in the database.

## Project layout

```
.
├── index.html, vite.config.ts, tailwind.config.js   # Frontend config (Vite dev server on :5001)
├── src/                     # React app
│   ├── apis/api.ts          # Axios instance, baseURL "/api"
│   ├── contexts/AuthContext.tsx
│   ├── routes/router.tsx    # Client routes (login + protected pages)
│   ├── pages/
│   │   ├── Pos.tsx, Tickets.tsx          # Point of sale & ticket history
│   │   ├── principal/                    # Login, Main dashboard
│   │   ├── structure/                    # Locals, Products, Services, Users admin
│   │   ├── bon_reception/                # Goods receptions (add / list / print)
│   │   └── cloture/                      # Daily closing declaration & management
│   ├── components/          # Navbar, TicketClient, ImageUploader, ui/ (shadcn)
│   └── locales/fr.json      # Translations
├── public/                  # Static assets, PWA files, fonts
├── dist/                    # Built frontend (output of `npm run build`)
└── server/                  # Express API
    ├── server.ts            # Entry point — listens on port 5000
    ├── src/app.ts           # Express app, CORS, sessions, static files
    ├── src/data/data.ts     # Mounts route modules under /api
    ├── src/routes/*.ts      # Route definitions
    ├── src/controllers/*.ts # Business logic
    ├── src/prismaSessionStore.ts
    ├── prisma/schema.prisma # DB schema + migrations
    ├── uploads/             # Uploaded images (products, categories, services, logos)
    └── dist/                # Compiled JS build of the server
```

## Data model (Prisma / MySQL)

`User` (roles `ADMIN` / `CAISSIER`), `Session`, `Locals` (point of sale, type `BELDI` / `TURKI` / `DEPOT`), `Categories`, `Products`, `Services`, `Stock`, `StockHistory`, `Sales`, `SalesProducts`, `SalesServices`, `ReceptionList`, `ReceptionProducts`, `TotalDay`.

## API endpoints

All are prefixed with `/api`.

| Module | Endpoints |
|---|---|
| `/auth` | `POST /register`, `POST /login`, `POST /check`, `POST /logout`, `GET /list`, `PUT /edit/:id`, `PUT /toggleBan/:id` |
| `/locals` | `POST /add`, `GET /list`, `PUT /edit/:id` |
| `/categories` | `POST /add`, `GET /list`, `PUT /edit/:id`, `PUT /toggleHide/:id` |
| `/products` | `POST /add`, `GET /list`, `PUT /edit/:id`, `PUT /toggleHide/:id` |
| `/services` | `POST /add`, `GET /list`, `PUT /edit/:id`, `DELETE /delete/:id`, `PUT /toggleHide/:id` |
| `/sales` | `GET /list`, `GET /items/:stat_id`, `POST /add`, `POST /add_item`, `DELETE /delete/:id`, `DELETE /delete_item`, `PUT /update_quantity`, `GET /all_products_services`, `GET /report` |
| `/reception` | `POST /add`, `GET /list`, `GET /items`, `DELETE /remove/:id` |
| `/cloture` | `GET /`, `POST /add`, `GET /list`, `PUT /update` |
| `/uploads` | Static uploaded images |

## Environment

`server/.env` (not committed):

```
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DBNAME"
SESSION_SECRET=...
API_TOKEN=...
NODE_ENV=production
PORT=3000            # note: currently unused — server.ts hard-codes 5000
```

## Getting started

```bash
# 1. Install dependencies
npm install
cd server && npm install && npx prisma generate && cd ..

# 2. Run frontend (:5001) + backend (:5000) together
npm run dev
```

Open http://localhost:5001. Vite proxies `/api` to the backend on port 5000.

Other scripts:

| Command | What it does |
|---|---|
| `npm run front` | Frontend only |
| `npm run build` | Type-check and build frontend into `dist/` |
| `cd server && npx ts-node server.ts` | Backend only (TypeScript) |
| `cd server && npm run build` | Compile backend to `server/dist/` |
| `cd server && node dist/server.js` | Run the compiled backend |
| `cd server && npx prisma migrate deploy` | Apply DB migrations |

## Production

The server serves the SPA from `path.join(__dirname, "../client")`, i.e. a `client/` folder next to the server's build output. Copy the frontend build (`dist/`) there when deploying.

## Troubleshooting

- **`TS7016: Could not find a declaration file for module 'express'`** — the `@types/*` dev packages are missing in `server/`. Run `cd server && npm install` (they are now listed in `devDependencies`).
- **`EADDRINUSE :::5000`** — another server is already running on port 5000. Stop it (`Get-NetTCPConnection -LocalPort 5000` in PowerShell shows the PID).
- **API calls fail in dev with 404** — make sure the Vite proxy in `vite.config.ts` is present and the backend is running on 5000.
- **`Failed to connect to the database`** — check `DATABASE_URL` and that the remote MySQL host is reachable.
- `server/package.json`'s `start` script (`node .`) points at `server.ts` and won't work with plain Node; use `node dist/server.js` instead.
