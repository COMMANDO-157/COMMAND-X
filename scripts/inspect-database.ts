import { clientFor, safeFailure } from "./database";
const client = clientFor(true);
try {
  await client.connect();
  const result = await client.query("select tablename from pg_tables where schemaname = 'public' order by tablename");
  console.log(JSON.stringify({ publicTables: result.rows.map((row) => row.tablename) }));
} catch (error) { safeFailure("Database inspection", error); }
finally { await client.end(); }
