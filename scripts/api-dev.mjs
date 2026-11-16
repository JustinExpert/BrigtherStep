// Local API server: runs the files in api/ the way Vercel does (api/auth/login.js → /api/auth/login).
// Run: npm run dev:api   (then `npm run dev` in another terminal; Vite forwards /api here)
import dns from "node:dns";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

try { process.loadEnvFile(".env"); } catch { /* use real environment variables */ }
// Some PCs point Node at a local DNS service that blocks the SRV lookup mongodb+srv needs.
dns.setServers(["1.1.1.1", "8.8.8.8", ...dns.getServers().filter((s) => s !== "127.0.0.1")]);

const PORT = Number(process.env.API_PORT || 3001);
const ROOT = path.resolve("api");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rel = url.pathname.replace(/^\/api\/?/, "");
  // Only plain route names; never serve helper files (api/_lib) or escape the folder.
  if (!url.pathname.startsWith("/api/") || !/^[a-z0-9-]+(\/[a-z0-9-]+)*$/i.test(rel) || rel.split("/").some((p) => p.startsWith("_"))) {
    res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "Not found" }));
  }
  const file = path.join(ROOT, rel + ".js");
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "Not found" })); }
  try {
    const mod = await import(pathToFileURL(file).href);
    req.query = Object.fromEntries(url.searchParams);
    await mod.default(req, res);
  } catch (e) {
    console.error(`[api] ${req.method} ${url.pathname} failed:`, e?.message);
    if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: "Server error" })); }
  }
  console.log(`[api] ${req.method} ${url.pathname} → ${res.statusCode}`);
});

server.listen(PORT, () => console.log(`BrighterStep API on http://localhost:${PORT}/api (database: ${process.env.MONGODB_DB || "brighterstep"})`));
