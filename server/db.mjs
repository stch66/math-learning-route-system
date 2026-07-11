import fs from "node:fs/promises";
import path from "node:path";

export function createJsonDbStore({ dbPath, createDefaultDb, normalizeDb = (db) => db }) {
  async function writeDb(db) {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const tmpPath = `${dbPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmpPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    await fs.rename(tmpPath, dbPath);
  }

  async function ensureDb() {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    try {
      const text = await fs.readFile(dbPath, "utf8");
      return JSON.parse(text);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const db = createDefaultDb();
      await writeDb(db);
      return db;
    }
  }

  async function readDb() {
    return normalizeDb(await ensureDb());
  }

  return { readDb, writeDb, dbPath };
}
