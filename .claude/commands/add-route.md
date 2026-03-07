Scaffold a new API route for ClaimFlow following all project conventions.

Resource description: $ARGUMENTS

If not fully specified above, ask the user for:
1. Resource name (singular, camelCase — e.g. "vehicle", "notification", "payment")
2. Operations needed: GET list, GET by id, POST create, PATCH update, DELETE

Then generate:

**`src/app/api/$RESOURCE/route.ts`** (if GET list or POST needed)
- Pattern: identical to `src/app/api/claims/route.ts`
- Auth check, Zod query schema, role filter, Prisma findMany/create, audit log

**`src/app/api/$RESOURCE/[id]/route.ts`** (if GET by id, PATCH, or DELETE needed)
- Pattern: identical to `src/app/api/claims/[id]/route.ts`

**`src/lib/validations.ts`** — add:
- `Create$ResourceSchema`
- `Update$ResourceSchema` (= Create.partial())
- `$ResourceQuerySchema`

**`src/types/index.ts`** — add any new enums or types

**`prisma/schema.prisma`** — add the model if it doesn't exist yet, then remind to run `/migrate`

Constraints to always respect:
- `z.string().cuid()` for all foreign key IDs
- `createAuditLog()` on POST/PATCH/DELETE
- Role check: HANDLER can only access their own data, MANAGER/ADMIN see all
- No `any` types
- Error responses: `{ error: string, details?: object }`
