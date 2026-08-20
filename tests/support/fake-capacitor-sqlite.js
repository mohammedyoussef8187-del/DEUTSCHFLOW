/*
 * Test double for @capacitor-community/sqlite 8.1.1.
 *
 * Mirrors the plugin's real API surface (createConnection / retrieveConnection /
 * isConnection / closeConnection, and on the connection: open, close, execute, query,
 * run, beginTransaction, commitTransaction, rollbackTransaction, isTransactionActive)
 * while executing against node:sqlite underneath. This lets the Capacitor executor be
 * verified for contract correctness on a workstation; it does not replace on-device
 * verification, which requires Xcode 26 / Android Studio Otter.
 *
 * Every call is recorded so tests can assert HOW the plugin is driven, in particular
 * that transaction=false is passed so the adapter's explicit transaction wins.
 */

import { DatabaseSync } from "node:sqlite";

export function createFakeSQLiteConnection() {
  const connections = new Map();
  const calls = [];

  function makeDbConnection(database) {
    const db = new DatabaseSync(":memory:");
    let transactionActive = false;

    return {
      calls,
      async open() { calls.push(["open", database]); },
      async close() { calls.push(["close", database]); db.close(); },

      async execute(statements, transaction = true, isSQL92 = true) {
        calls.push(["execute", statements, transaction, isSQL92]);
        db.exec(statements);
        return { changes: { changes: 0 } };
      },

      async query(statement, values = [], isSQL92 = true) {
        calls.push(["query", statement, values, isSQL92]);
        return { values: db.prepare(statement).all(...values) };
      },

      async run(statement, values = [], transaction = true, returnMode = "no", isSQL92 = true) {
        calls.push(["run", statement, values, transaction, returnMode, isSQL92]);
        const result = db.prepare(statement).run(...values);
        return { changes: { changes: Number(result.changes ?? 0) } };
      },

      async beginTransaction() {
        calls.push(["beginTransaction"]);
        db.exec("BEGIN");
        transactionActive = true;
        return { changes: { changes: 0 } };
      },
      async commitTransaction() {
        calls.push(["commitTransaction"]);
        db.exec("COMMIT");
        transactionActive = false;
        return { changes: { changes: 0 } };
      },
      async rollbackTransaction() {
        calls.push(["rollbackTransaction"]);
        db.exec("ROLLBACK");
        transactionActive = false;
        return { changes: { changes: 0 } };
      },
      async isTransactionActive() {
        return { result: transactionActive };
      }
    };
  }

  return {
    calls,
    async createConnection(database, encrypted, mode, version, readonly) {
      calls.push(["createConnection", database, encrypted, mode, version, readonly]);
      const connection = makeDbConnection(database);
      connections.set(`${database}:${readonly}`, connection);
      return connection;
    },
    async retrieveConnection(database, readonly) {
      calls.push(["retrieveConnection", database, readonly]);
      return connections.get(`${database}:${readonly}`);
    },
    async isConnection(database, readonly) {
      return { result: connections.has(`${database}:${readonly}`) };
    },
    async closeConnection(database, readonly) {
      calls.push(["closeConnection", database, readonly]);
      connections.delete(`${database}:${readonly}`);
    }
  };
}
