# Database Permissions Fix

## Current Issue

The database user `brax1227` doesn't have proper permissions to create/modify tables in the `stacked_wins` database.

## Quick Fix Options

### Option 1: Grant Permissions (Recommended)

Run as PostgreSQL superuser (postgres):

```bash
psql -d stacked_wins -U postgres << EOF
GRANT ALL PRIVILEGES ON DATABASE stacked_wins TO brax1227;
GRANT ALL ON SCHEMA public TO brax1227;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO brax1227;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO brax1227;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO brax1227;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO brax1227;
EOF
```

### Option 2: Use Postgres User for Development

Update `backend/.env`:
```env
DATABASE_URL="postgresql://postgres@localhost:5432/stacked_wins?schema=public"
```

### Option 3: Create Tables Manually

Tables can be created manually (we did this for journal_entries and feedback). All other tables need to be created.

## Verify Connection

After fixing permissions, test:

```bash
cd backend
npx prisma db push
```

Or test registration:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

**Note:** This is a local development issue. In production, the database user will have proper permissions.
