// Shared MongoDB connection for local scripts (loads .env, never prints the URI).
import dns from "node:dns";
import { MongoClient } from "mongodb";

try { process.loadEnvFile(".env"); } catch { /* fall back to real environment variables */ }

export const uri = (process.env.MONGODB_URI || "").trim();
export const dbName = process.env.MONGODB_DB || "brighterstep";

/** Removes the password from any text before it is printed. */
export const redact = (s) => String(s).replace(/(mongodb(?:\+srv)?:\/\/[^:\s]+:)[^@\s]+@/g, "$1****@");

/**
 * Connects to Atlas. Some PCs point Node at a local DNS service (127.0.0.1, e.g. from a VPN or
 * ad-blocker) that refuses the SRV lookup mongodb+srv needs; in that case retry once with public DNS.
 */
export async function connect(options = {}) {
  const open = async () => {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: "brighterstep-scripts", ...options });
    await client.connect();
    return client;
  };
  try {
    return await open();
  } catch (e) {
    if (!/querySrv|ECONNREFUSED.*_mongodb|ENOTFOUND _mongodb/i.test(String(e?.message))) throw e;
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
    console.log("(Local DNS refused the lookup; retrying with public DNS 1.1.1.1 / 8.8.8.8.)");
    return await open();
  }
}
