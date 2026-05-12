---
name: db-management
description: Use this skill for database tasks. Activates on: "migration", "schema change", "database setup", "SQLite", "seed data", "add column", "create table", or any request that modifies the database structure.
---

# Skill: Database Management — BotArena

## Stack
- **Database:** SQLite 3
- **Pattern:** Repository Pattern — all queries must go through Repository classes
- **Setup script:** `execution/ci_setup_db.js`

## Migration Rules
1. Every schema change requires a numbered migration file: `migrations/00X_description.sql`
2. Every migration must have UP and DOWN sections:
```sql
-- UP
ALTER TABLE settings ADD COLUMN new_field TEXT;

-- DOWN
ALTER TABLE settings DROP COLUMN new_field;
```
3. Never run ALTER TABLE directly in production — always via migration file
4. After creating a migration, run `npm run teste-banco` to validate

## Repository Rules
- SQL queries outside Repository classes are **prohibited**
- Every new table requires a corresponding Repository class in `src/repositories/`
- Inject connection via constructor — never import directly inside methods
- Every Repository extends `BaseRepository`

## CI Setup Script
```bash
# Cleans and reinitializes SQLite with seed data
node execution/ci_setup_db.js
```
Run before: integration tests, E2E tests, CI pipeline

## Seed Data
- Company: Arena Juvenal
- Default settings: bot active, empty pix key
- Knowledge base: initial FAQ entries

## Prohibited
- Direct SQL outside Repositories
- Schema changes without a migration file
- Deleting migration files after running them
- Running ci_setup_db.js in production