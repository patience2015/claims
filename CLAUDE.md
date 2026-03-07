# Claims Project — ClaimFlow AI

## Project Overview
Plateforme de gestion des sinistres automobiles augmentée par IA (Claude API).
Extraction automatique, scoring de fraude, estimation d'indemnisation, génération de courriers.

## Stack technique
- **Framework** : Next.js 15 (App Router, TypeScript strict)
- **UI** : Tailwind CSS + composants custom (shadcn-style)
- **ORM** : Prisma 6 (SQLite dev / PostgreSQL prod)
- **Auth** : NextAuth v5 (Credentials + JWT 8h)
- **IA** : Anthropic Claude API (claude-sonnet-4-6)
- **Tests** : Vitest + Testing Library + Playwright E2E
- **MCP** : serveur local barèmes d'indemnisation

## Structure
```
claims/
├── docs/               ← Specs BA + Architecture
├── claimflow/          ← Application Next.js 15
│   ├── prisma/         ← Schema + seed
│   ├── src/
│   │   ├── app/        ← Pages + API routes
│   │   ├── components/ ← UI components
│   │   ├── lib/        ← Services métier + IA
│   │   └── types/      ← Types partagés
│   ├── tests/          ← Vitest unit/integration
│   ├── e2e/            ← Playwright E2E
│   └── mcp/            ← Serveur MCP barèmes
```

## Conventions
- TypeScript strict : zéro `any`
- Zod sur 100% des entrées API
- Audit trail sur toutes les mutations
- Numérotation sinistres : `CLM-YYYY-NNNNN`
- Modèle IA : `claude-sonnet-4-6`

## Commandes utiles (dans claimflow/)

```bash
# Installation
npm install

# Base de données
npx prisma migrate dev --name init
npx prisma db seed
npx prisma studio    # Interface web Prisma

# Développement
npm run dev          # → http://localhost:3000

# Tests
npm run test         # Vitest + coverage
npm run test:watch   # Mode watch
npm run test:e2e     # Playwright E2E

# Build production
npm run build
npm start

# MCP barèmes (dans mcp/)
npx ts-node mcp/baremes-server.ts
```

## Pipeline agents (agentpack.md)

### Commandes du workflow principal
| Commande | Agent | Mission |
|----------|-------|---------|
| `/ba` | Business Analyst | User Story → specs Gherkin + règles métier + JSON |
| `/architect` | Architecte | Specs → contrats API + Prisma + plan par équipe + DoD |
| `/backend` | Dev Backend | Plan → routes API + Prisma + Zod + audit trail + tests |
| `/frontend` | Dev Frontend | Plan → pages + composants + formulaires + charts |
| `/ia` | IA Engineer | Prompts + fonctions Claude + endpoints IA + orchestration /analyze |
| `/qa` | QA | TDD Vitest + tests composants + E2E Playwright + coverage ≥ 60% |
| `/mcp` | MCP | Barèmes d'indemnisation via serveur MCP local |
| `/review` | Release/Review | Audit sécurité + perf + lisibilité + commit conventionnel |
| `/run-pipeline` | Orchestrateur | Pipeline complet : BA → Architecte → Dev → QA → Review |

### Commandes utilitaires projet
| Commande | Description |
|----------|-------------|
| `/seed` | Reset + reseed BDD (3 users + 10 sinistres) |
| `/test` | Vitest + coverage + diagnostic auto |
| `/migrate` | Nouvelle migration Prisma |
| `/review-route` | Audit checklist d'une route API |
| `/add-route` | Scaffolde une nouvelle route API |
| `/fraud` | Explique le pipeline de détection de fraude |
| `/analyze-claim` | Déclenche l'analyse IA complète sur un sinistre |

### Agents spécialisés (`.claude/agents/`)
| Agent | Usage |
|-------|-------|
| `fraud-analyst` | Investigation fraude : corrélations + rapport structuré |
| `qa` | Correction tests + coverage |
| `migration` | Évolution schéma en cascade |
| `feature-dev` | Nouvelle feature full-stack de bout en bout |

## Hooks automatiques

| Événement | Déclencheur | Action |
|-----------|-------------|--------|
| Edit/Write | `schema.prisma` | Rappel de migration |
| Edit/Write | `validations.ts` | Rappel de cohérence types |
| Edit/Write | `api/*/route.ts` | Checklist auth+Zod+audit |
| Bash | `migrate reset` sans `--force` | **Bloqué** |
| Bash | `git push --force` | **Bloqué** |
| Bash | `rm -rf` sur répertoires critiques | **Bloqué** |

## Comptes de démonstration
| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Gestionnaire | julie@claimflow.ai | password123 |
| Manager | marc@claimflow.ai | password123 |
| Admin | thomas@claimflow.ai | password123 |

## Variables d'environnement (.env.local)
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="claimflow-secret-change-in-production-2026"
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="sk-ant-..."
```
