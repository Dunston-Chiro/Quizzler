import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const globalForNeon = globalThis as unknown as {
  _neonPool?: Pool;
};

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Resilient fallback placeholder during Next.js static asset build / bundling
    return "postgresql://placeholder:placeholder@ep-dummy-pooler.us-east-2.aws.neon.tech/placeholder?sslmode=require";
  }
  return url;
}

const connectionString = getConnectionString();

// Module-level singleton pattern: reuses the connection pool across warm Vercel serverless invocations
export const pool =
  globalForNeon._neonPool ??
  new Pool({
    connectionString,
  });

globalForNeon._neonPool = pool;

export const db = drizzle(pool, { schema });
export default db;
