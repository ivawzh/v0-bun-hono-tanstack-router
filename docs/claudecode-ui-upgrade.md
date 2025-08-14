# Claude Code UI Upgrade Guide

## NPM to Bun Migration

### Issue: SQLite3 Native Bindings Error
```
error: Could not locate the bindings file. Tried:
 → /path/to/node_modules/.bun/sqlite3@5.1.7/node_modules/sqlite3/build/node_sqlite3.node
```

### Solution: Replace sqlite3 with bun:sqlite

**Code Changes:**
```javascript
// Before
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
const db = await open({ filename: dbPath, driver: sqlite3.Database });
const rows = await db.all('SELECT * FROM table');

// After  
import { Database } from 'bun:sqlite';
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT * FROM table').all();
```

**Package.json:**
```diff
- "sqlite": "^5.1.1",
- "sqlite3": "^5.1.7",
```

**API Changes:**
- `await db.all(sql)` → `db.prepare(sql).all()`
- `await db.get(sql)` → `db.prepare(sql).get()`
- `await db.close()` → `db.close()`

## Upgrade Process

### 1. Upstream Updates
```bash
cd apps/claudecode-ui
git stash  # Save local changes
git checkout main
git pull upstream main
```

### 2. Resolve Conflicts
- Check package.json for new npm dependencies
- Update imports: npm packages → bun equivalents
- Fix API calls: async/await → sync where applicable
- Remove native binding dependencies

### 3. Apply Migration
```bash
# Clean dependencies
rm -rf node_modules bun.lockb package-lock.json

# Update package.json (remove sqlite3, sqlite)
# Update code (sqlite3 → bun:sqlite)

# Install with bun
bun install
```

### 4. Test
```bash
bun run dev
# Verify: server starts without binding errors
# Check: database operations work correctly
```

## Files to Update

**Key files when sqlite3 conflicts occur:**
- `server/projects.js` - Claude project SQLite operations
- `server/routes/cursor.js` - Cursor session SQLite operations  
- `package.json` - Remove sqlite3/sqlite dependencies

**Common conflict pattern:**
1. Upstream adds new features using npm packages
2. Our bun environment can't handle native bindings
3. Replace with bun-native equivalents
4. Update API calls for sync vs async differences

This process ensures Claude Code UI works with Bun while maintaining Solo Unicorn integration.