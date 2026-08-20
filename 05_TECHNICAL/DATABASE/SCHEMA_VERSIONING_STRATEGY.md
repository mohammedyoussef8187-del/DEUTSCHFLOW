# Schema Versioning Strategy (SCHEMA_VERSIONING_STRATEGY.md)

This document defines the schema upgrade and migration lifecycle strategy for the upgraded **DeutschFlow** application database.

---

## 1. Schema Version Control

The database is versioned utilizing a single integer schema version tracker:
*   **Version 1:** Initial database schema version (new modular SQLite structure).
*   **Metadata tracking:** The schema version is saved in a dedicated `schema_versions` table or stored as a PRAGMA user_version in the SQLite file header:
    ```sql
    PRAGMA user_version;
    ```

---

## 2. Migration Execution Lifecycle

Database upgrades are applied sequentially on application initialization:

```
                  ┌──────────────────────┐
                  │   App Init Trigger   │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Read schema version  │
                  └──────────┬───────────┘
                             │
                ┌────────────┴────────────┐
                ▼ Current = Target        ▼ Current < Target
          ┌──────────┐              ┌──────────┐
          │ Run App  │              │ Backup   │
          └──────────┘              │ Database │
                                    └────┬─────┘
                                         │
                                         ▼
                                    ┌──────────┐
                                    │ Apply    │
                                    │ Migration│
                                    └────┬─────┘
                                         │
                        ┌────────────────┴────────────────┐
                        ▼ Success                         ▼ Failure
                  ┌──────────┐                      ┌──────────┐
                  │ Update   │                      │ Restore  │
                  │ version  │                      │ Backup   │
                  │ & Run    │                      │ & Lock   │
                  └──────────┘                      └──────────┘
```

### 2.1 Backup Before Migration
Before executing any structural SQL schema modifications:
1.  Locate the database file pathway.
2.  Copy the production database file to a temporary backup file (`deutschflow.db.bak`).
3.  Proceed to run the migration scripts.

### 2.2 Rollback Protocols
If any SQL query inside a migration step throws an error:
1.  Abort the migration sequence immediately.
2.  Roll back the active SQLite transaction.
3.  Delete the corrupted database file.
4.  Restore the database from the backup copy (`deutschflow.db.bak`).
5.  Raise a critical migration exception to the UI layer, prompting the user to contact support or restore a manual JSON backup.
