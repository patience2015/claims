# TP ClaimFlow AI — Portail Intelligent de Gestion des Sinistres

> **Formation Claude Code pour Developpeurs** — Leadmind AI
> **Duree** : 5 jours (1 semaine)
> **Equipe** : 2 developpeurs
> **Date** : Fevrier 2026

---

```
   ____  _       _           _____ _                       _    ___
  / ___|| | __ _(_)_ __ ___ |  ___| | _____      __      / \  |_ _|
 | |    | |/ _` | | '_ ` _ \| |_  | |/ _ \ \ /\ / /     / _ \  | |
 | |___ | | (_| | | | | | | |  _| | | (_) \ V  V /     / ___ \ | |
  \____||_|\__,_|_|_| |_| |_|_|   |_|\___/ \_/\_/     /_/   \_\___|

  L'IA au service de la gestion des sinistres
  De la declaration a l'indemnisation en quelques minutes
```

---

## A propos de ce TP

Ce Travail Pratique vous plonge dans le developpement d'une application fullstack reelle, liee au secteur de l'assurance. Vous allez construire **ClaimFlow AI**, un portail intelligent de gestion des sinistres automobiles augmente par l'intelligence artificielle.

Ce projet est directement inspire des innovations du marche :
- **Allianz (Projet Nemo)** : -80% du temps de traitement des sinistres
- **Sedgwick (Sidekick Agent)** : +30% d'efficacite
- **Aviva** : 82M$ d'economies grace a l'automatisation

**Votre mission** : Construire un POC fonctionnel en 5 jours, en utilisant Claude Code comme outil principal de developpement.

---

## Sommaire

1. [Contexte et objectifs](#1-contexte-et-objectifs)
2. [Description du projet](#2-description-du-projet)
3. [Stack technique](#3-stack-technique)
4. [Organisation du travail](#4-organisation-du-travail)
5. [Sprint Plan — 5 jours](#5-sprint-plan--5-jours)
6. [Specifications fonctionnelles](#6-specifications-fonctionnelles)
7. [Architecture technique](#7-architecture-technique)
8. [Integration IA](#8-integration-ia)
9. [Donnees de test](#9-donnees-de-test)
10. [Criteres d'evaluation](#10-criteres-devaluation)
11. [Bonus et challenges](#11-bonus-et-challenges)
12. [Ressources](#12-ressources)

---

## 1. Contexte et objectifs

### 1.1 Contexte metier

La gestion des sinistres est le **premier poste de couts** des compagnies d'assurance. Aujourd'hui :
- Un gestionnaire traite 15-20 dossiers par jour
- La saisie manuelle prend 15-20 minutes par dossier
- La fraude represente **5 a 10% des primes collectees** en Europe
- Les delais de traitement impactent la satisfaction client

L'IA generative revolutionne ce domaine : extraction automatique, detection de fraude, generation de courriers, estimation d'indemnisation.

### 1.2 Objectifs pedagogiques

Ce TP vise a :

| Objectif | Ce que vous apprendrez |
|----------|----------------------|
| **Maitriser Claude Code** | Utiliser toutes les fonctionnalites : plan mode, agent teams, MCP, hooks, code review |
| **Developper fullstack** | Frontend React + Backend API + Base de donnees + Integration IA |
| **Travailler en equipe** | Coordination frontend/backend, contrats API, Git collaboratif |
| **Integrer l'IA** | Appeler Claude API, concevoir des prompts, parser des reponses structurees |
| **Assurer la qualite** | TDD, tests E2E, code review, linting automatique |

### 1.3 Valeur commerciale

Ce POC est capitalisable pour Leadmind AI :
- **Demonstrable** a tout directeur sinistres ou DSI d'assureur
- **Chiffres d'impact** documentes (Allianz, Aviva, Sedgwick)
- **Extensible** vers un produit commercial (multi-branches, integrations SI)

---

## 2. Description du projet

### 2.1 Pitch

**ClaimFlow AI** est un portail web intelligent qui transforme la gestion des sinistres automobiles en automatisant l'extraction des donnees, la detection de fraude et la generation de courriers grace a l'IA. Les gestionnaires traitent leurs dossiers **5 fois plus vite**, avec moins d'erreurs et une detection proactive des anomalies.

### 2.2 Fonctionnalites principales

```
┌────────────────────────────────────────────────────────────────┐
│                    CLAIMFLOW AI — Features                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. DECLARATION DE SINISTRE                                    │
│     • Formulaire multi-etapes (assure, vehicule, faits, docs) │
│     • Upload de photos et documents                            │
│     • Numero de sinistre automatique                           │
│                                                                │
│  2. ANALYSE IA AUTOMATIQUE                                     │
│     • Extraction des donnees structurees                       │
│     • Scoring de fraude (0-100) avec indicateurs visuels       │
│     • Estimation du montant d'indemnisation                    │
│     • Generation de courriers automatiques                     │
│                                                                │
│  3. WORKFLOW DE TRAITEMENT                                     │
│     • Statuts : Nouveau → Analyse → Attente → Approuve/Refuse │
│     • Attribution aux gestionnaires                            │
│     • Escalade automatique si fraude > 70                      │
│     • Commentaires internes + historique (audit trail)         │
│                                                                │
│  4. DASHBOARD & ANALYTICS                                      │
│     • KPIs temps reel (nb sinistres, montants, delais)         │
│     • Graphiques (evolution, repartition par type)             │
│     • Filtres avances                                          │
│                                                                │
│  5. ADMINISTRATION                                             │
│     • Gestion des utilisateurs et roles                        │
│     • Configuration des regles metier                          │
│     • Export CSV                                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.3 Personas

**Julie (32 ans) — Gestionnaire sinistres**
- Traite 15-20 dossiers/jour, frustrée par la saisie repetitive
- Veut : traiter plus vite, etre alertee sur les cas suspects

**Marc (45 ans) — Manager sinistres**
- Supervise 8 gestionnaires, manque de visibilite
- Veut : piloter avec des dashboards, reduire les delais

**Thomas (28 ans) — Administrateur**
- Gere les comptes et la configuration
- Veut : administrer facilement via une interface

---

## 3. Stack technique

| Couche | Technologie | Pourquoi |
|--------|-------------|----------|
| **Framework** | Next.js 15 (App Router) | Fullstack monorepo, TypeScript partage |
| **Langage** | TypeScript (strict) | Securite de types, meilleure DX |
| **UI** | Tailwind CSS + shadcn/ui | Design system ready-to-use |
| **Graphiques** | Recharts | Libraire React native |
| **ORM** | Prisma | Type-safe, migrations auto |
| **Base de donnees** | SQLite (dev) | Zero config, un fichier |
| **IA** | Anthropic Claude API | Extraction, scoring, generation |
| **Auth** | NextAuth.js v5 | Solution standard Next.js |
| **Validation** | Zod | Schemas runtime + TypeScript |
| **Tests** | Vitest + Testing Library + Playwright | Unitaires + composants + E2E |
| **Qualite** | ESLint + Prettier + Husky | Linting, formatage, hooks |

---

## 4. Organisation du travail

### 4.1 Repartition en binome

| | Developpeur A — "Backend & IA" | Developpeur B — "Frontend & UX" |
|---|---|---|
| **Focus** | API, base de donnees, logique metier, integration Claude API | Interface utilisateur, composants, pages, graphiques |
| **Technologies** | Prisma, API Routes, Anthropic SDK, Vitest | React, Tailwind, shadcn/ui, Recharts, Playwright |
| **Livrable principal** | API fonctionnelle + 4 endpoints IA | Application web complete et connectee |

### 4.2 Points de synchronisation

| Moment | Objet | Duree |
|--------|-------|-------|
| **J1 fin de matinee** | Validation schema Prisma + contrat API | 30 min |
| **J2 fin de journee** | Demo croisee API + maquettes UI | 30 min |
| **J3 debut de journee** | Integration frontend ↔ backend | 1h |
| **J4 milieu de journee** | Revue des fonctionnalites IA dans le UI | 30 min |
| **J5 matin** | Tests croises (A teste le frontend, B teste l'API) | 1h |

---

## 5. Sprint Plan — 5 jours

---

### JOUR 1 : Setup et fondations

> **Fonctionnalites Claude Code a exercer** : scaffolding, plan mode

#### Dev A (Backend)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | Initialiser le projet | "Initialise un projet Next.js 15 avec TypeScript, Tailwind, Prisma, SQLite. Configure ESLint, Prettier et Husky." |
| 2 | Concevoir la DB | **Plan mode** : "Concois le schema de base de donnees pour une application de gestion de sinistres auto avec : utilisateurs (roles), assures, vehicules, sinistres (statuts), documents, analyses IA, commentaires, audit log." |
| 3 | Generer le schema Prisma | Faire generer le fichier `prisma/schema.prisma` complet |
| 4 | Migrer et seeder | Executer les migrations et creer un seed avec des donnees de test |

**Livrable J1-A** : Projet initialise, schema DB migre, seed fonctionnel

#### Dev B (Frontend)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | Installer shadcn/ui | `npx shadcn@latest init` + composants (Button, Card, Input, Table, Badge, Dialog, Form, Select, Tabs) |
| 2 | Concevoir le layout | **Plan mode** : "Concois le layout avec sidebar de navigation, header avec profil, zone de contenu." |
| 3 | Generer le layout | Faire generer layout.tsx, Sidebar.tsx, Header.tsx |
| 4 | Creer les pages | Pages vides avec routing : /dashboard, /claims, /claims/new, /claims/[id], /admin |
| 5 | Configurer l'auth | NextAuth avec provider Credentials + page login |

**Livrable J1-B** : Layout complet, routing en place, auth fonctionnelle

---

### JOUR 2 : Backend API et premiers composants

> **Fonctionnalites Claude Code a exercer** : TDD, code generation, debugging

#### Dev A (Backend)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | **Exercice TDD** | "Ecris d'abord les tests pour GET /api/claims (pagination, filtrage, recherche), puis implemente l'endpoint pour faire passer les tests." |
| 2 | CRUD Claims | Implementer tous les endpoints (GET list, POST, GET detail, PUT, DELETE) |
| 3 | CRUD Policyholders | Endpoints assures + endpoint commentaires |
| 4 | Upload documents | Endpoint multipart pour /api/claims/:id/documents |
| 5 | Tests d'integration | Tests pour tous les endpoints |

**Livrable J2-A** : API REST complete, tous les tests passent

#### Dev B (Frontend)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | Tableau des sinistres | Composant ClaimsTable : colonnes, pagination, tri |
| 2 | Filtres | Select statut, select type, recherche, date picker |
| 3 | Page liste | /claims integrant tableau + filtres |
| 4 | Badges de statut | ClaimStatusBadge avec code couleur |
| 5 | Formulaire declaration | Formulaire multi-etapes (4 steps : assure, vehicule, faits, documents) |

**Livrable J2-B** : Liste des sinistres et formulaire fonctionnels (avec mocks)

---

### JOUR 3 : Integration IA — Le coeur du projet

> **Fonctionnalites Claude Code a exercer** : agent teams, MCP servers, hooks

#### Dev A (Backend — IA)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | SDK Anthropic | `npm install @anthropic-ai/sdk` |
| 2 | **Exercice Agent Teams** | "Cree une equipe d'agents pour generer simultanement les 4 prompts systeme : extraction, scoring fraude, estimation, generation de courrier. Chaque agent produit un prompt optimise pour l'assurance auto." |
| 3 | Service IA | Implementer `ai.service.ts` avec 4 fonctions d'appel Claude API |
| 4 | Endpoints IA | /api/ai/extract, /api/ai/fraud, /api/ai/estimate, /api/ai/letter |
| 5 | Orchestration | /api/claims/:id/analyze qui enchaine les 3 analyses |
| 6 | **Exercice Hooks** | Configurer un hook pre-commit qui verifie le format des prompts IA |

**Livrable J3-A** : 4 endpoints IA fonctionnels, prompts optimises, hook valide

#### Dev B (Frontend — IA)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | Panneau d'analyse IA | Composant AIAnalysisPanel (resultats d'extraction) |
| 2 | Score de fraude | Composant FraudScoreCard (jauge 0-100, couleurs, indicateurs) |
| 3 | Estimation | Composant EstimationCard (montant min/max/probable, ventilation) |
| 4 | Generation courrier | Composant LetterGenerator (selection type, apercu, generation) |
| 5 | Integration page detail | Assembler dans /claims/[id] |
| 6 | **Exercice MCP** | Configurer un MCP server qui expose les baremes d'indemnisation |

**Livrable J3-B** : Composants IA integres, MCP fonctionnel

---

### JOUR 4 : Dashboard, polish et refactoring

> **Fonctionnalites Claude Code a exercer** : multi-file edit, refactoring

#### Dev A (Backend)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | API Dashboard | Endpoint /api/dashboard/stats (KPIs) et /api/dashboard/charts (graphiques) |
| 2 | Workflow statuts | Regles metier : auto-approbation si montant < 2000€ et fraude < 30, escalade si fraude > 70 |
| 3 | Export CSV | Endpoint /api/admin/export |
| 4 | **Exercice refactoring** | "Refactore ai.service.ts en fichiers separes (extraction.service.ts, fraud.service.ts, estimation.service.ts, letter.service.ts) en preservant l'interface commune." |

**Livrable J4-A** : Dashboard API + workflow + export + code refactore

#### Dev B (Frontend)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | Dashboard | 4 cartes KPI + 2 graphiques Recharts (line chart + pie chart) |
| 2 | Sinistres recents | Composant RecentClaims dans le dashboard |
| 3 | Timeline | Composant ClaimTimeline (frise chronologique des actions) |
| 4 | Administration | Page CRUD utilisateurs + configuration seuils |
| 5 | **Exercice refactoring** | "Le ClaimForm fait 400 lignes. Decompose-le en 4 sous-composants (StepPolicyholder, StepVehicle, StepCircumstances, StepDocuments)." |

**Livrable J4-B** : Dashboard complet, timeline, admin, code refactore

---

### JOUR 5 : Tests, qualite et demo

> **Fonctionnalites Claude Code a exercer** : debugging, code review, /commit, tests E2E

#### Dev A (Backend)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | Tests | Completer pour couverture > 60% |
| 2 | **Exercice debugging** | Introduire 3 bugs volontaires. Demander a Claude de les trouver et corriger. |
| 3 | **Exercice code review** | "Fais une review complete du backend. Identifie les problemes de securite et les ameliorations." |
| 4 | Corrections | Corriger les problemes identifies |
| 5 | Seed enrichi | 20 sinistres couvrant tous les cas |

#### Dev B (Frontend)

| # | Tache | Consigne Claude Code |
|---|-------|---------------------|
| 1 | Tests E2E | 3 scenarios Playwright : login, creation sinistre, dashboard |
| 2 | Tests composants | Tests pour ClaimForm, FraudScoreCard, StatsCard |
| 3 | **Exercice debugging** | Corriger les problemes UX (responsive, loading, erreurs) |
| 4 | **Exercice /commit** | Commit conventionnel avec message genere par Claude |
| 5 | Preparation demo | Creer le scenario de demonstration |

#### Demo finale (15 minutes)

```
Scenario de demonstration :

1. [2 min] LOGIN : Julie se connecte au portail
2. [1 min] DASHBOARD : Vue d'ensemble KPIs + graphiques
3. [3 min] DECLARATION : Nouveau sinistre (formulaire 4 etapes + upload photos)
4. [3 min] ANALYSE IA : Extraction auto + scoring fraude (72 = alerte!) + estimation
5. [2 min] WORKFLOW : Escalade auto au manager Marc, Marc approuve
6. [2 min] COURRIER : Generation automatique du courrier a l'assure
7. [2 min] EXPORT : Marc exporte les stats en CSV
```

---

## 6. Specifications fonctionnelles

> Le cahier des charges complet est disponible dans `03-cahier-des-charges.md`

### 6.1 Epics et user stories prioritaires

**Epic 1 : Authentification** (Priorite : HAUTE)
- US-1.1 : Se connecter avec email/mot de passe
- US-1.2 : Voir mon profil et mon role
- US-1.3 : Etre redirige selon mon role (gestionnaire → sinistres, manager → dashboard)

**Epic 2 : Declaration de sinistre** (Priorite : HAUTE)
- US-2.1 : Remplir un formulaire multi-etapes
- US-2.2 : Uploader des photos et documents
- US-2.3 : Recevoir un numero de sinistre automatique (CLM-2026-XXXXX)
- US-2.4 : Sauvegarder en brouillon

**Epic 3 : Analyse IA** (Priorite : HAUTE)
- US-3.1 : Lancer l'analyse IA en un clic
- US-3.2 : Voir les donnees extraites automatiquement
- US-3.3 : Voir le score de fraude avec indicateurs visuels (vert/orange/rouge)
- US-3.4 : Voir l'estimation du montant d'indemnisation
- US-3.5 : Generer un courrier automatique

**Epic 4 : Workflow** (Priorite : HAUTE)
- US-4.1 : Voir la liste des sinistres avec filtres
- US-4.2 : Changer le statut d'un sinistre
- US-4.3 : Attribuer un sinistre a un gestionnaire
- US-4.4 : Ajouter des commentaires internes
- US-4.5 : Voir l'historique des actions (audit trail)

**Epic 5 : Dashboard** (Priorite : MOYENNE)
- US-5.1 : Voir les KPIs (nb sinistres par statut, montants, delais)
- US-5.2 : Voir des graphiques d'evolution temporelle et repartition
- US-5.3 : Filtrer par periode

**Epic 6 : Administration** (Priorite : BASSE)
- US-6.1 : Gerer les utilisateurs (CRUD)
- US-6.2 : Configurer les seuils (fraude, auto-approbation)
- US-6.3 : Exporter les donnees en CSV

### 6.2 Regles metier cles

| Regle | Description |
|-------|-------------|
| **Auto-approbation** | Si montant estime < 2 000€ ET scoring fraude < 30 → approbation automatique |
| **Escalade manager** | Si scoring fraude > 70 → assignation automatique au manager |
| **Statuts** | new → analyzing → pending_docs → approved/rejected → closed |
| **Numeration** | Format CLM-YYYY-NNNNN (auto-increment) |
| **Delai** | Alerte si aucune action dans les 48h apres creation |
| **Types de sinistres** | collision, vol, vandalisme, catastrophe naturelle, bris de glace, incendie |

---

## 7. Architecture technique

> L'architecture complete est disponible dans `02-architecture.md`

### 7.1 Diagramme

```
┌─────────────────────────────────────────────────────────────┐
│                      CLAIMFLOW AI                            │
│                                                              │
│  ┌─────────────┐     ┌─────────────┐    ┌───────────────┐  │
│  │  Frontend    │────▶│  Backend    │───▶│  SQLite       │  │
│  │  Next.js     │◀────│  API Routes │◀───│  Prisma ORM   │  │
│  │  React       │     │  Next.js    │    │               │  │
│  │  Tailwind    │     │             │    └───────────────┘  │
│  │  shadcn/ui   │     └──────┬──────┘                       │
│  └─────────────┘            │                               │
│                              ▼                               │
│                     ┌───────────────┐                       │
│                     │  Claude API   │                       │
│                     │  (Anthropic)  │                       │
│                     │               │                       │
│                     │ • Extraction  │                       │
│                     │ • Fraude      │                       │
│                     │ • Estimation  │                       │
│                     │ • Courriers   │                       │
│                     └───────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Endpoints API principaux

| Domaine | Endpoints |
|---------|-----------|
| **Auth** | POST /api/auth/signin, POST /api/auth/signout, GET /api/auth/session |
| **Claims** | GET/POST /api/claims, GET/PUT/DELETE /api/claims/:id, POST /api/claims/:id/analyze |
| **Documents** | GET/POST /api/claims/:id/documents |
| **Comments** | GET/POST /api/claims/:id/comments |
| **AI** | POST /api/ai/extract, /api/ai/fraud, /api/ai/estimate, /api/ai/letter |
| **Dashboard** | GET /api/dashboard/stats, GET /api/dashboard/charts |
| **Admin** | CRUD /api/admin/users, GET /api/admin/export |

---

## 8. Integration IA

### 8.1 Les 4 fonctionnalites IA

#### Extraction d'information
A partir de la description libre du sinistre, extraire automatiquement :
- Date, heure, lieu de l'incident
- Type de sinistre et severite
- Vehicules impliques et dommages
- Blessures eventuelles
- Tiers implique
- Informations manquantes

#### Scoring de fraude (0-100)
Evaluer la coherence de la declaration :
- Coherence temporelle et geographique
- Proportionnalite des dommages
- Presence de temoins
- Delai de declaration
- Indicateurs classiques de fraude

Seuils :
- 0-30 : Risque faible (vert)
- 31-60 : Risque modere (orange)
- 61-80 : Risque eleve (rouge)
- 81-100 : Risque critique (rouge fonce)

#### Estimation d'indemnisation
Bareme simplifie :
- Bris de glace : 200 - 1 500 EUR
- Dommages carrosserie legers : 500 - 3 000 EUR
- Dommages carrosserie moyens : 3 000 - 8 000 EUR
- Dommages carrosserie graves : 8 000 - 20 000 EUR
- Vehicule irreparable : valeur venale
- Dommages corporels legers : 1 000 - 5 000 EUR

#### Generation de courrier
Types de courriers :
- Accuse de reception de la declaration
- Demande de pieces complementaires
- Notification d'approbation avec montant
- Notification de refus avec motifs
- Demande d'information complementaire

### 8.2 Configuration

```env
# .env.example
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="votre-secret-ici"
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="[CLE_API_ANTHROPIC]"
```

---

## 9. Donnees de test

### 9.1 Utilisateurs

| Nom | Email | Role | Mot de passe |
|-----|-------|------|-------------|
| Julie Martin | julie@claimflow.ai | handler | password123 |
| Marc Dubois | marc@claimflow.ai | manager | password123 |
| Thomas Petit | thomas@claimflow.ai | admin | password123 |

### 9.2 Assures et vehicules

| Assure | Police | Vehicule |
|--------|--------|----------|
| Jean Dupont | POL-2024-001 | Renault Clio 2022 (AB-123-CD) |
| Marie Lambert | POL-2024-002 | Peugeot 308 2021 (EF-456-GH) |
| Pierre Martin | POL-2024-003 | Volkswagen Golf 2023 (IJ-789-KL) |
| Sophie Leroy | POL-2024-004 | Toyota Yaris 2020 (MN-012-OP) |
| Lucas Bernard | POL-2024-005 | BMW Serie 3 2022 (QR-345-ST) |

### 9.3 Sinistres d'exemple

| # | Assure | Type | Description resumee | Score fraude attendu |
|---|--------|------|--------------------|--------------------|
| 1 | Jean Dupont | collision | Accrochage sur parking supermarche, retro casse | ~15 (faible) |
| 2 | Marie Lambert | vol | Vol du vehicule la nuit, declaration le lendemain matin | ~25 (faible) |
| 3 | Pierre Martin | collision | Collision a un carrefour, tiers en tort | ~10 (faible) |
| 4 | Sophie Leroy | vandalisme | Rayures sur toute la carrosserie, pas de temoin | ~40 (modere) |
| 5 | Lucas Bernard | collision | Accident sur autoroute, degats importants | ~20 (faible) |
| 6 | Jean Dupont | bris_glace | Pare-brise fissure par un caillou sur autoroute | ~5 (faible) |
| 7 | Marie Lambert | collision | 2eme sinistre en 3 mois, circonstances vagues | ~75 (eleve) |
| 8 | Pierre Martin | incendie | Vehicule incendie dans un parking, assurance augmentee recemment | ~85 (critique) |
| 9 | Sophie Leroy | catastrophe_naturelle | Grele ayant endommage le toit et le capot | ~5 (faible) |
| 10 | Lucas Bernard | vol | Vol declare 2 semaines apres les faits, pas de depot de plainte | ~70 (eleve) |

---

## 10. Criteres d'evaluation

### 10.1 Grille de notation

| Critere | Poids | Description |
|---------|:-----:|-------------|
| **Fonctionnalites** | 40% | Toutes les user stories prioritaires livrees et fonctionnelles |
| **Qualite du code** | 20% | TypeScript strict, pas de `any`, code propre, separation des responsabilites |
| **Tests** | 15% | Couverture > 60%, tests E2E, tests unitaires pertinents |
| **Utilisation Claude Code** | 15% | Preuve d'utilisation des 14 fonctionnalites (voir checklist) |
| **Demo** | 10% | Demo fluide de 15 min, scenario complet |

### 10.2 Checklist Claude Code (14 fonctionnalites)

| # | Fonctionnalite | Jour | Exercice | Fait ? |
|---|---------------|------|----------|:------:|
| 1 | Scaffolding | J1 | Initialisation du projet | ☐ |
| 2 | Plan mode | J1 | Conception schema DB + layout | ☐ |
| 3 | Code generation | J1-J5 | Generation composants, services, API | ☐ |
| 4 | TDD | J2 | Tests API avant implementation | ☐ |
| 5 | Debugging | J2, J5 | Correction bugs volontaires/involontaires | ☐ |
| 6 | Agent Teams | J3 | Generation parallele des 4 prompts IA | ☐ |
| 7 | MCP Servers | J3 | Serveur MCP baremes d'indemnisation | ☐ |
| 8 | Hooks | J3 | Pre-commit validation prompts IA | ☐ |
| 9 | Multi-file edit | J4 | Refactoring service IA + formulaire | ☐ |
| 10 | Refactoring | J4 | Decomposition fichiers volumineux | ☐ |
| 11 | Code review | J5 | Review complete du backend | ☐ |
| 12 | /commit | J5 | Commit conventionnel via Claude | ☐ |
| 13 | Tests E2E | J5 | Scenarios Playwright | ☐ |
| 14 | Tests composants | J5 | Testing Library composants critiques | ☐ |

---

## 11. Bonus et challenges

| # | Challenge | Points | Difficulte |
|---|-----------|:------:|:----------:|
| 1 | **Mode sombre** : theme sombre avec next-themes | +2 | Facile |
| 2 | **Notifications in-app** : alertes sur changement de statut | +3 | Moyen |
| 3 | **Export PDF** : rapport PDF du sinistre avec @react-pdf/renderer | +3 | Moyen |
| 4 | **Deploiement Vercel** : deployer avec PostgreSQL (Neon) | +2 | Moyen |
| 5 | **MCP externe** : API meteo reelle (conditions au moment du sinistre) | +4 | Difficile |
| 6 | **Chatbot RAG** : interroger les dossiers en langage naturel | +5 | Difficile |
| 7 | **Analyse d'image** : Claude Vision pour analyser les photos de degats | +4 | Difficile |

---

## 12. Ressources

### Documentation technique
| Ressource | Lien |
|-----------|------|
| Next.js | https://nextjs.org/docs |
| Prisma | https://www.prisma.io/docs |
| Claude API | https://docs.anthropic.com |
| Claude TS SDK | https://github.com/anthropics/anthropic-sdk-typescript |
| shadcn/ui | https://ui.shadcn.com |
| Tailwind CSS | https://tailwindcss.com/docs |
| Recharts | https://recharts.org |
| NextAuth.js | https://authjs.dev |
| Vitest | https://vitest.dev |
| Playwright | https://playwright.dev |

### Documentation Claude Code
| Ressource | Lien |
|-----------|------|
| Guide officiel | https://docs.anthropic.com/en/docs/claude-code |
| Plan mode | https://docs.anthropic.com/en/docs/claude-code/plan-mode |
| Agent Teams | https://docs.anthropic.com/en/docs/claude-code/agent-teams |
| MCP Servers | https://docs.anthropic.com/en/docs/claude-code/mcp-servers |
| Hooks | https://docs.anthropic.com/en/docs/claude-code/hooks |

### Contexte metier
- Article de reference : `article.md` (Agents IA et actuariat)
- Allianz Projet Nemo : -80% temps de traitement
- Sedgwick Sidekick : +30% efficacite
- Aviva : 82M$ d'economies en 2024

---

## Documents annexes

Les documents detailles sont disponibles dans le meme dossier :

| Document | Fichier | Contenu |
|----------|---------|---------|
| Analyse de marche | `01-market-analysis.md` | Justification du choix de projet, donnees marche |
| Architecture technique | `02-architecture.md` | Stack, schema Prisma, API, structure, prompts IA |
| Cahier des charges | `03-cahier-des-charges.md` | User stories, regles metier, wireframes ASCII, donnees de test |
| Plan pedagogique | `04-plan-pedagogique.md` | Sprint plan detaille, checklist Claude Code, criteres d'evaluation |

---

**Bon courage et bonne formation !**

*Concu par l'equipe d'agents IA de Leadmind AI — Fevrier 2026*
*Projet capitalisable pour les propositions commerciales aux clients assurance*
