# Database Migration Guide

## ⚠️ Hostinger MySQL — Use `db push` NOT `migrate dev`

Hostinger MySQL users do not have permission to create shadow databases,
which `prisma migrate dev` requires. Use this instead:

```bash
# From apps/api directory:
npx prisma db push

# Then regenerate the Prisma client:
npx prisma generate
```

## Why?

`prisma migrate dev` needs to create a temporary "shadow database" to
compare schemas. Hostinger restricts this. `prisma db push` directly
applies your schema changes without needing a shadow database.

## After making schema changes

```bash
# 1. Apply schema to database
npx prisma db push

# 2. Regenerate Prisma client
npx prisma generate

# 3. Restart the API server
npm run dev
```

## Production deploy

```bash
# Use db push in production too (or migrate deploy if you have migrations folder)
npx prisma db push --accept-data-loss  # Only if you understand data implications
```
