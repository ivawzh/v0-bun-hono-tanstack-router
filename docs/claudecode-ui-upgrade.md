# Claude Code UI Upgrade Guide

## V1.7.0 Upgrade Completed ✅

**Status**: Successfully upgraded to V1.7.0 on 2025-08-14
**Migration**: All sqlite3 dependencies converted to bun:sqlite
**Testing**: Database operations and server startup verified

Original upgrade guide: `git checkout main && git pull && npm install`

However, we have modified the code to use Bun instead of npm, also changed a few code. So that you will need to carefully git resolve the conflicts.

Also, everytime after upgrade, please review this document to see if there are any changes that you need to apply for future upgrade reference.

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

## Git Remote Configuration

**Current Setup (Updated 2025-08-14):**
- `origin`: `git@github.com:ivawzh/claudecodeui.git` (your fork)
- `upstream`: `git@github.com:siteboon/claudecodeui.git` (siteboon's repo)

## Upgrade Process

### 1. Upstream Updates
```bash
cd apps/claudecode-ui
git stash  # Save local changes
git checkout main
git fetch upstream  # Fetch latest from siteboon
git pull upstream main  # Pull updates from siteboon
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

### 5. Push to Fork
```bash
git add .
git commit -m "chore: upgrade to latest version with bun compatibility"
git push origin main  # Push to your fork
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

## V1.7.0 Upgrade Summary

### Completed Steps (2025-08-14)
1. ✅ **Version Check**: Confirmed current version is V1.7.0 
2. ✅ **Code Migration**: All key files already using `bun:sqlite`:
   - `server/projects.js` - Claude project SQLite operations
   - `server/routes/cursor.js` - Cursor session SQLite operations  
   - `server/database/db.js` - Database initialization
3. ✅ **Dependencies**: Package.json clean (no sqlite3/sqlite dependencies)
4. ✅ **Installation**: `bun install` completed successfully
5. ✅ **Testing**: Database operations verified, no binding errors

### Files Updated During Migration
- All files already properly migrated to `bun:sqlite`
- No additional code changes required

### Verification Results
- `bun:sqlite` import and database operations work correctly
- Server startup works (port conflicts are environmental, not code issues)
- No native binding errors detected

**Next Upgrade**: Follow same process - check for new sqlite3 usage and convert to bun:sqlite as needed.
