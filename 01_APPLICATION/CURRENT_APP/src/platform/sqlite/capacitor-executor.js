/*
 * Capacitor native SQLite executor (@capacitor-community/sqlite).
 *
 * Implements the same async executor contract as the Node test executor, so the
 * platform-neutral SQLite adapter runs unchanged on device:
 *   exec(sql) | run(sql, params) | all(sql, params) | transaction(fn) | pragma(name, value?)
 *
 * This is the ONLY module that knows the plugin exists. The learning engine, SRS, answer
 * evaluator, and UI reach storage through repositories -> adapter -> this executor
 * (DECISION_LOG DF-010: business logic must never query the plugin API directly).
 *
 * Verified against @capacitor-community/sqlite 8.1.1 (peer @capacitor/core >= 8.0.0):
 *   createConnection(database, encrypted, mode, version, readonly) -> SQLiteDBConnection
 *   open() / close() / closeConnection(database, readonly)
 *   execute(statements, transaction?, isSQL92?) -> capSQLiteChanges
 *   query(statement, values?, isSQL92?)        -> { values?: any[] }
 *   run(statement, values?, transaction?, returnMode?, isSQL92?) -> capSQLiteChanges
 *   beginTransaction() / commitTransaction() / rollbackTransaction() / isTransactionActive()
 *
 * Note: the plugin's `execute` and `run` wrap each call in their own transaction by
 * default. Every call below passes transaction=false so the adapter's explicit
 * BEGIN/COMMIT is the single source of transaction control and imports stay
 * genuinely all-or-nothing.
 */

// Only [A-Za-z_] identifiers are accepted; PRAGMA names cannot be parameter-bound, so
// interpolation is constrained rather than trusted.
const PRAGMA_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const DATABASE_NAME = "deutschflow";

/**
 * Wrap an already-open SQLiteDBConnection in the executor contract.
 * @param {object} db an open SQLiteDBConnection (or a test double implementing it)
 */
export function createCapacitorSqliteExecutor(db) {
  if (!db) throw new TypeError("An open SQLiteDBConnection is required");

  return {
    async exec(sql) {
      await db.execute(sql, false);
    },

    async run(sql, params = []) {
      await db.run(sql, params, false);
    },

    async all(sql, params = []) {
      const result = await db.query(sql, params);
      return result?.values ?? [];
    },

    async transaction(fn) {
      await db.beginTransaction();
      try {
        await fn();
        await db.commitTransaction();
      } catch (error) {
        // Only roll back if the transaction is still open; a failed commit may have
        // already ended it, and rolling back twice throws over the original error.
        try {
          const active = await db.isTransactionActive();
          if (active?.result !== false) await db.rollbackTransaction();
        } catch {
          /* preserve the original failure below */
        }
        throw error;
      }
    },

    async pragma(name, value) {
      if (!PRAGMA_NAME.test(String(name))) throw new RangeError(`Invalid PRAGMA name: ${name}`);
      if (value === undefined) {
        const result = await db.query(`PRAGMA ${name}`);
        const row = result?.values?.[0];
        return row ? Object.values(row)[0] : null;
      }
      if (!Number.isFinite(Number(value))) throw new RangeError(`Invalid PRAGMA value: ${value}`);
      await db.execute(`PRAGMA ${name} = ${Number(value)}`, false);
      return value;
    }
  };
}

/**
 * Open the learner database on device and return { executor, close }.
 *
 * The plugin is imported lazily so Node test runs and the web build never load native
 * code. Encryption stays OFF until the SQLCipher export-compliance review required by
 * DECISION_LOG DF-010 (condition 6) is complete.
 *
 * @param {object} [options]
 *   database   database name (default "deutschflow")
 *   version    schema version passed to the plugin's connection registry
 *   encrypted  leave false until SQLCipher compliance is signed off
 *   readonly   open a read-only connection
 *   connection inject an SQLiteConnection (tests); otherwise the real plugin is used
 */
export async function openCapacitorSqlite(options = {}) {
  const {
    database = DATABASE_NAME,
    version = 1,
    encrypted = false,
    readonly = false,
    mode = "no-encryption",
    connection = null
  } = options;

  let sqlite = connection;
  if (!sqlite) {
    const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
    sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  // Reuse an existing registered connection rather than creating a duplicate, which the
  // plugin rejects.
  const existing = await sqlite.isConnection(database, readonly);
  const db = existing?.result
    ? await sqlite.retrieveConnection(database, readonly)
    : await sqlite.createConnection(database, encrypted, mode, version, readonly);

  await db.open();

  // Foreign keys are OFF by default in SQLite and must be enabled per connection for the
  // canonical schema's referential integrity to be enforced.
  await db.execute("PRAGMA foreign_keys = ON", false);

  return {
    executor: createCapacitorSqliteExecutor(db),
    database,
    async close() {
      await db.close();
      await sqlite.closeConnection(database, readonly);
    }
  };
}
