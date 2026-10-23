// Builds a ready-to-upload bundle for a Hostinger Node.js Web App.
//
//   npm run build:hostinger
//
// Output: build/hostinger/ and charamelcheikh-hostinger.zip at the repo root.
// Layout of the bundle (the app root on Hostinger):
//   package.json            start = node dist/server.js, postinstall = prisma generate
//   dist/server.js, dist/src/  compiled Express server
//   dist/client/            built React app (served by Express)
//   dist/firebase-service-account.json
//   prisma/                 schema + migrations
//   uploads/                product/service/category/local images
//   .env                    copied from server/.env (contains secrets, never commit)
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = path.join(root, "server");
const out = path.join(root, "build", "hostinger");
const zipFile = path.join(root, "charamelcheikh-hostinger.zip");

const run = (cmd, cwd) => {
  console.log(`\n> ${cmd}  (${path.relative(root, cwd) || "."})`);
  execSync(cmd, { cwd, stdio: "inherit" });
};
const copy = (from, to) => {
  if (!fs.existsSync(from)) return false;
  fs.cpSync(from, to, { recursive: true });
  return true;
};

// 1. Build the frontend and the server
run("npm run build", root);
// Only clear the compiled code: server/dist may hold other files worth keeping
fs.rmSync(path.join(server, "dist", "src"), { recursive: true, force: true });
run("npx tsc", server);

// 2. Assemble the bundle
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

copy(path.join(server, "dist", "server.js"), path.join(out, "dist", "server.js"));
copy(path.join(server, "dist", "src"), path.join(out, "dist", "src"));
copy(path.join(root, "dist"), path.join(out, "dist", "client"));
copy(path.join(server, "prisma"), path.join(out, "prisma"));
copy(path.join(server, "uploads"), path.join(out, "uploads"));
for (const dir of ["categories", "locals_logo", "products", "services"]) {
  fs.mkdirSync(path.join(out, "uploads", dir), { recursive: true });
}
copy(path.join(server, "package-lock.json"), path.join(out, "package-lock.json"));

const warnings = [];
if (!copy(path.join(server, "firebase-service-account.json"), path.join(out, "dist", "firebase-service-account.json"))) {
  warnings.push("server/firebase-service-account.json not found: push notifications will be off.");
}
if (!copy(path.join(server, ".env"), path.join(out, ".env"))) {
  warnings.push("server/.env not found: set DATABASE_URL, SESSION_SECRET, API_TOKEN in Hostinger's environment variables.");
}

// Production package.json: no dev tooling, start the compiled server
const pkg = JSON.parse(fs.readFileSync(path.join(server, "package.json"), "utf8"));
delete pkg.devDependencies;
delete pkg.dependencies.nodemon;
delete pkg.dependencies["ts-node"];
pkg.main = "dist/server.js";
pkg.scripts = {
  start: "node dist/server.js",
  postinstall: "prisma generate",
  migrate: "prisma migrate deploy",
};
pkg.engines = { node: ">=18" };
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

// 3. Zip it (entries use forward slashes so Linux unzips them correctly)
fs.rmSync(zipFile, { force: true });
if (process.platform === "win32") {
  const tar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
  const entries = fs.readdirSync(out).map((e) => `"${e}"`).join(" ");
  run(`"${tar}" -a -cf "${zipFile}" ${entries}`, out);
} else {
  run(`zip -qr "${zipFile}" . -x "*.DS_Store"`, out);
}

console.log(`\nBundle ready: ${path.relative(root, zipFile)} (${(fs.statSync(zipFile).size / 1e6).toFixed(1)} MB)`);
warnings.forEach((w) => console.warn(`WARNING: ${w}`));
