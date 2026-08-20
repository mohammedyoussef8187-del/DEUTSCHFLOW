/*
 * Test-only SQLite executor backed by Node's built-in `node:sqlite` (Node >= 22).
 *
 * Implements the async executor contract expected by the platform-neutral SQLite
 * adapter. Used to exercise the adapter against isolated, disposable databases
 * (in-memory by default, or a temporary file) without touching real learner data or
 * requiring the native Capacitor plugin. The device build supplies an equivalent
 * executor backed by @capacitor-community/sqlite.
 */

import { DatabaseSync } from "node:sqlite";

export function createNodeSqliteExecutor(location = ":memory:") {
  const db = new DatabaseSync(location);
  db.exec("PRAGMA foreign_keys = ON");

  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    async all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async transaction(fn) {
      db.exec("BEGIN");
      try {
        await fn();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async pragma(name, value) {
      if (value === undefined) {
        const row = db.prepare(`PRAGMA ${name}`).get();
        return row ? Object.values(row)[0] : null;
      }
      db.exec(`PRAGMA ${name} = ${value}`);
      return value;
    },
    async close() {
      db.close();
    }
  };
}
