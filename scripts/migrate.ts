import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { clientFor, safeFailure } from "./database";
const client = clientFor(true);
try {
  await client.connect();
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied successfully.");
} catch (error) { safeFailure("Migration", error); }
finally { await client.end(); }
