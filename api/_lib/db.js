// Shared MongoDB connection for the API (Vercel serverless functions).
// The client is cached between requests on the same server instance, so most requests
// reuse an open connection instead of reconnecting to Atlas each time.
import { MongoClient } from "mongodb";

const globalCache = globalThis.__brighterstepMongo || (globalThis.__brighterstepMongo = { client: null, promise: null });

export function dbName() {
  return process.env.MONGODB_DB || "brighterstep";
}

/** Returns a connected MongoClient (throws a safe Error if MONGODB_URI is missing). */
export async function getClient() {
  const uri = (process.env.MONGODB_URI || "").trim();
  if (!uri) throw Object.assign(new Error("MONGODB_URI is not set on the server"), { code: "NO_URI" });
  if (globalCache.client) return globalCache.client;
  if (!globalCache.promise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5, appName: "brighterstep-api" });
    globalCache.promise = client.connect().then((c) => (globalCache.client = c)).catch((e) => {
      globalCache.promise = null; // allow a retry on the next request
      throw e;
    });
  }
  return globalCache.promise;
}

export async function getDb() {
  return (await getClient()).db(dbName());
}

/** Turns a driver error into a short, safe reason (never includes the connection string). */
export function safeReason(e) {
  const msg = String(e?.message || "");
  if (e?.code === "NO_URI") return "MONGODB_URI is not set in Vercel → Settings → Environment Variables.";
  if (/auth|Authentication failed/i.test(msg)) return "Atlas rejected the username or password in MONGODB_URI.";
  if (/querySrv|ENOTFOUND|getaddrinfo/i.test(msg)) return "The cluster address in MONGODB_URI could not be found.";
  if (/timed out|Server selection|ECONNREFUSED/i.test(msg)) return "Atlas did not answer in time (check Network Access allows 0.0.0.0/0).";
  if (/Invalid scheme|mongodb\+srv|URI/i.test(msg)) return "MONGODB_URI is not a valid connection string.";
  return "Could not connect to the database.";
}
