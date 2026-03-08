Reseed the ClaimFlow database from scratch.

Steps:
1. `cd /c/projets/claims/claimflow`
2. Run: `DATABASE_URL="file:./dev.db" npx prisma migrate reset --force`
3. Confirm the seed completed successfully
4. Display the seeded accounts table:

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Gestionnaire | handler@claimflow.fr | handler123 |
| Manager | manager@claimflow.fr | manager123 |
| Admin | admin@claimflow.fr | admin123 |

5. Show the count of seeded claims (should be 10, including 3 fraud cases)
