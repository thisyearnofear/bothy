import pg from "pg";

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://bothy:bothy@localhost:5432/bothy",
});

export async function q(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
