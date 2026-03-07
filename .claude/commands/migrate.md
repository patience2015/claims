Create and apply a new Prisma migration for ClaimFlow.

Ask the user for a migration name (snake_case, e.g. "add_vehicle_mileage").

Then execute:
1. `cd /c/projets/claims/claimflow`
2. `DATABASE_URL="file:./dev.db" npx prisma migrate dev --name $MIGRATION_NAME`
3. `DATABASE_URL="file:./dev.db" npx prisma generate`
4. Show the generated SQL from the new migration file in `prisma/migrations/`
5. Remind: "If you added new fields, update the Zod schemas in src/lib/validations.ts and the TypeScript types in src/types/index.ts"

If the migration fails, read the Prisma error and suggest a fix.
