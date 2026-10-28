import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js stores local environment variables in .env.local
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations require direct (unpooled) connection to acquire advisory locks
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
