# Architecture Technique — Fraude Réseau (fraude-reseau)

**Version** : 1.0
**Date** : 2026-03-08
**Auteur** : Agent Architecte
**Statut** : Approuvé pour implémentation

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture cible — fichiers](#2-architecture-cible--fichiers)
3. [Schéma Prisma complet](#3-schéma-prisma-complet)
4. [Contrats API détaillés](#4-contrats-api-détaillés)
5. [Types TypeScript principaux](#5-types-typescript-principaux)
6. [Algorithme Union-Find](#6-algorithme-union-find)
7. [Tâches par équipe](#7-tâches-par-équipe)
8. [Graphe de dépendances](#8-graphe-de-dépendances)
9. [Definition of Done](#9-definition-of-done)
10. [Résumé JSON pour agents](#10-résumé-json-pour-agents)

---

## 1. Vue d'ensemble

La feature **Fraude Réseau** ajoute une couche de détection de fraude coordonnée par analyse de graphe (réseau de sinistres). Elle complète le scoring individuel existant (`analyzeFraud()`) en détectant des clusters d'acteurs (assurés, garages, experts, lieux) partageant plusieurs sinistres suspects.

### Flux principal

```
Analyse fraude individuelle
        │
        ▼
fraud-network-service.ts
  ├── buildLinks()          ← Création des FraudLinks entre nœuds
  ├── runUnionFind()        ← Détection des clusters (Union-Find)
  ├── scoreNetwork()        ← Calcul networkScore 0-100 par sinistre
  └── classifyRisk()        ← SUSPECT | CRITICAL selon RG-NET-003
        │
        ▼
analyzeFraud() (enriched)   ← +20pts SUSPECT / +35pts CRITICAL injectés
        │
        ▼
API /api/fraud-networks/*   ← Consultation MANAGER/ADMIN + actions
        │
        ▼
Pages /fraud-networks/*     ← Liste + graphe D3.js interactif
```

### Règles métier clés

| Règle | Description |
|-------|-------------|
| RG-NET-001 | Nœuds : POLICYHOLDER, GARAGE, EXPERT, LOCATION |
| RG-NET-002 | FraudLink entre paires partageant un sinistre, poids 0.5–1.2/occurrence, plafond 10.0 |
| RG-NET-003 | SUSPECT : ≥3 nœuds + ≥2 sinistres + avgScore≥40 + densité≥0.3 ; CRITICAL : ≥6+5+65+0.6 |
| RG-NET-004 | networkScore 0–100 par sinistre |
| RG-NET-005 | networkScore injecté dans analyzeFraud() : +20pts SUSPECT / +35pts CRITICAL |
| RG-NET-006 | Recalcul : post-analyse + cron 02h00 UTC + manuel ADMIN |
| RG-NET-007 | MANAGER+ADMIN : accès complet ; HANDLER : voit seulement networkScore dans Claim |
| RG-NET-008 | Actions MANAGER : Dismiss → DISMISSED / Escalade → UNDER_INVESTIGATION |
| RG-NET-009 | Normalisation : garage (case-insensitive+SIRET), expert (prénom+nom), lieu (commune+CP) |
| RG-NET-010 | DISMISSED archivés après 1 an, FraudLinks orphelins → stale=true |

---

## 2. Architecture cible — fichiers

### Fichiers à créer

```
claimflow/src/
├── app/
│   ├── api/
│   │   └── fraud-networks/
│   │       ├── route.ts                          ← GET /api/fraud-networks (liste paginée)
│   │       ├── recompute/
│   │       │   └── route.ts                      ← POST /api/fraud-networks/recompute
│   │       └── [id]/
│   │           └── route.ts                      ← GET + PATCH /api/fraud-networks/[id]
│   └── fraud-networks/
│       ├── page.tsx                              ← Liste des réseaux (MANAGER/ADMIN)
│       └── [id]/
│           └── page.tsx                          ← Détail + graphe D3.js
├── components/
│   └── fraud-network/
│       ├── FraudNetworkList.tsx                  ← Tableau avec filtres + statuts
│       ├── FraudNetworkGraph.tsx                 ← Graphe D3.js force-directed
│       ├── FraudNetworkBadge.tsx                 ← Badge SUSPECT/CRITICAL
│       └── FraudNetworkActions.tsx               ← Boutons Dismiss / Escalader
└── lib/
    └── fraud-network-service.ts                  ← Service principal (Union-Find + scoring)
```

### Fichiers à modifier

```
claimflow/
├── prisma/
│   └── schema.prisma                             ← +FraudNetwork +FraudLink +FraudNetworkAudit +champs Claim
├── src/
│   ├── types/
│   │   └── index.ts                              ← +FraudNetworkItem +FraudLinkItem +FraudNodeItem +FraudNetworkRisk +AuditAction
│   ├── lib/
│   │   ├── ai-service.ts                         ← analyzeFraud() : injection networkScore/networkRisk
│   │   ├── prompts/
│   │   │   └── fraud.ts                          ← Ajout contexte réseau dans fraudUserPrompt()
│   │   └── validations.ts                        ← +FraudNetworkQuerySchema +FraudNetworkActionSchema +RecomputeSchema
│   └── middleware.ts                             ← +/fraud-networks → MANAGER|ADMIN, +/api/fraud-networks → MANAGER|ADMIN
```

### Migrations Prisma (2 fichiers auto-générés)

```
claimflow/prisma/migrations/
├── YYYYMMDD_add_fraud_network_tables/
│   └── migration.sql
└── YYYYMMDD_add_claim_network_fields/
    └── migration.sql
```

---

## 3. Schéma Prisma complet

```prisma
// ─── Nouveaux modèles ────────────────────────────────────────────────────────

model FraudNetwork {
  id          String   @id @default(cuid())
  /// Statut du réseau détecté
  status      String   @default("ACTIVE")
  // "ACTIVE" | "DISMISSED" | "UNDER_INVESTIGATION"

  /// Niveau de risque global du réseau
  risk        String
  // "SUSPECT" | "CRITICAL"

  /// Nombre de nœuds dans le réseau
  nodeCount   Int      @default(0)

  /// Nombre de sinistres impliqués
  claimCount  Int      @default(0)

  /// Score moyen des sinistres du réseau (0-100)
  avgScore    Float    @default(0)

  /// Densité du graphe (arêtes / arêtes_max)
  density     Float    @default(0)

  /// Métadonnées JSON : liste des nœuds avec type+label+normalizedKey
  nodesJson   String   @default("[]")
  // [{ id, type, label, normalizedKey, claimCount, avgScore }]

  /// Raison de dismiss (si DISMISSED)
  dismissReason String?

  /// ID du manager ayant agi
  actionByUserId String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  /// Date d'archivage automatique (DISMISSED + 1 an)
  archivedAt  DateTime?

  links       FraudLink[]
  audits      FraudNetworkAudit[]
  claims      Claim[]             @relation("ClaimFraudNetwork")

  @@index([status])
  @@index([risk])
  @@index([createdAt])
}

model FraudLink {
  id              String   @id @default(cuid())

  /// Type du nœud source
  sourceType      String
  // "POLICYHOLDER" | "GARAGE" | "EXPERT" | "LOCATION"

  /// Clé normalisée du nœud source (ex: siret, "prénom nom", "commune-cp")
  sourceKey       String

  /// Label lisible du nœud source
  sourceLabel     String

  /// Type du nœud cible
  targetType      String

  /// Clé normalisée du nœud cible
  targetKey       String

  /// Label lisible du nœud cible
  targetLabel     String

  /// Poids de la liaison (0.5–1.2 par occurrence, plafonné à 10.0)
  weight          Float    @default(0.5)

  /// Nombre d'occurrences (sinistres partagés)
  occurrences     Int      @default(1)

  /// Lien devenu obsolète (nœuds sans sinistre actif)
  stale           Boolean  @default(false)

  networkId       String
  network         FraudNetwork @relation(fields: [networkId], references: [id], onDelete: Cascade)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([networkId, sourceKey, targetKey])
  @@index([networkId])
  @@index([stale])
}

model FraudNetworkAudit {
  id          String   @id @default(cuid())

  /// Action réalisée
  action      String
  // "NETWORK_CREATED" | "NETWORK_DISMISSED" | "NETWORK_ESCALATED"
  // | "NETWORK_RECOMPUTED" | "NETWORK_ARCHIVED"

  networkId   String
  network     FraudNetwork @relation(fields: [networkId], references: [id], onDelete: Cascade)

  /// ID de l'utilisateur ayant déclenché l'action (null = système/cron)
  userId      String?

  /// Snapshot de l'état avant
  before      String?  // JSON
  /// Snapshot de l'état après
  after       String?  // JSON
  /// Contexte additionnel
  metadata    String?  // JSON

  createdAt   DateTime @default(now())

  @@index([networkId])
  @@index([action])
}

// ─── Modifications sur Claim ─────────────────────────────────────────────────
// Ajouter ces champs au modèle Claim existant :

// model Claim {
//   ...champs existants...
//
//   /// Garage de réparation (normalisé case-insensitive + SIRET optionnel)
//   repairGarage    String?
//
//   /// Nom de l'expert mandaté (normalisé "prénom nom")
//   expertName      String?
//
//   /// Score réseau calculé (0-100)
//   networkScore    Int?
//
//   /// Niveau de risque réseau
//   networkRisk     String?   // "SUSPECT" | "CRITICAL" | null
//
//   /// Réseau auquel ce sinistre appartient (null si aucun cluster)
//   networkId       String?
//   network         FraudNetwork? @relation("ClaimFraudNetwork", fields: [networkId], references: [id])
// }
```

### Notes sur les migrations

1. **Migration 1** (`add_fraud_network_tables`) : crée `FraudNetwork`, `FraudLink`, `FraudNetworkAudit`
2. **Migration 2** (`add_claim_network_fields`) : ajoute `repairGarage`, `expertName`, `networkScore`, `networkRisk`, `networkId` sur `Claim`

Les deux migrations sont générées séquentiellement via `npx prisma migrate dev`.

---

## 4. Contrats API détaillés

### 4.1 GET /api/fraud-networks

**Description** : Liste paginée des réseaux de fraude détectés.

```
Auth:    MANAGER | ADMIN
Input (query params, Zod FraudNetworkQuerySchema):
  {
    page:     number (défaut 1)
    pageSize: number (défaut 20, max 50)
    status:   "ACTIVE" | "DISMISSED" | "UNDER_INVESTIGATION" (optionnel)
    risk:     "SUSPECT" | "CRITICAL" (optionnel)
    dateFrom: string ISO (optionnel)
    dateTo:   string ISO (optionnel)
  }

Output 200:
  {
    data: FraudNetworkItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }

Errors:
  401 — non authentifié
  403 — rôle insuffisant (HANDLER ou POLICYHOLDER)
  400 — paramètres invalides (Zod)

Audit: NON (lecture seule)
```

### 4.2 GET /api/fraud-networks/[id]

**Description** : Détail complet d'un réseau, incluant nœuds, liens et sinistres associés.

```
Auth:    MANAGER | ADMIN
Input:   id (path param, cuid)

Output 200:
  {
    id: string
    status: FraudNetworkStatus
    risk: FraudNetworkRisk
    nodeCount: number
    claimCount: number
    avgScore: number
    density: number
    nodes: FraudNodeItem[]          ← désérialisé depuis nodesJson
    links: FraudLinkItem[]
    claims: {
      id: string
      claimNumber: string
      status: string
      networkScore: number | null
      fraudScore: number | null
      policyholder: { firstName: string; lastName: string; email: string }
    }[]
    audits: {
      id: string
      action: string
      userId: string | null
      createdAt: string
      metadata: string | null
    }[]
    dismissReason: string | null
    actionByUserId: string | null
    createdAt: string
    updatedAt: string
  }

Errors:
  401 — non authentifié
  403 — rôle insuffisant
  404 — réseau introuvable

Audit: NON (lecture seule)
```

### 4.3 PATCH /api/fraud-networks/[id]

**Description** : Actions métier sur un réseau (Dismiss ou Escalade).

```
Auth:    MANAGER | ADMIN
Input (body, Zod FraudNetworkActionSchema):
  {
    action:       "DISMISS" | "ESCALATE"
    dismissReason?: string (min 20 cars, requis si action=DISMISS)
  }

Output 200:
  {
    id: string
    status: FraudNetworkStatus      ← nouveau statut après action
    updatedAt: string
  }

Errors:
  400 — body invalide (Zod) | action impossible depuis statut courant
  401 — non authentifié
  403 — rôle insuffisant
  404 — réseau introuvable
  409 — réseau déjà DISMISSED ou UNDER_INVESTIGATION (transition invalide)

Audit: OUI
  action: "NETWORK_DISMISSED" | "NETWORK_ESCALATED"
  entityType: "FRAUD_NETWORK"
  entityId: id
  before: { status: ancienStatut }
  after:  { status: nouveauStatut, dismissReason? }
  userId: session.user.id
```

### 4.4 POST /api/fraud-networks/recompute

**Description** : Déclenche un recalcul complet de tous les réseaux (ADMIN uniquement).

```
Auth:    ADMIN
Input (body, Zod RecomputeSchema):
  {
    scope?: "FULL" | "INCREMENTAL"   ← défaut "FULL"
  }

Output 202:
  {
    message: string           ← "Recalcul lancé en arrière-plan"
    networksCreated: number
    networksUpdated: number
    claimsLinked: number
    durationMs: number
  }

Errors:
  400 — body invalide
  401 — non authentifié
  403 — rôle insuffisant (HANDLER ou MANAGER)

Audit: OUI
  action: "NETWORK_RECOMPUTED"
  entityType: "FRAUD_NETWORK"
  entityId: "GLOBAL"
  metadata: { scope, networksCreated, networksUpdated, claimsLinked, durationMs }
  userId: session.user.id
```

---

## 5. Types TypeScript principaux

```typescript
// ─── src/types/index.ts — ajouts ────────────────────────────────────────────

// Statuts d'un réseau de fraude
export type FraudNetworkStatus =
  | "ACTIVE"
  | "DISMISSED"
  | "UNDER_INVESTIGATION";

// Niveau de risque réseau (différent de FraudRisk individuel)
export type FraudNetworkRisk = "SUSPECT" | "CRITICAL";

// Types de nœuds dans le graphe
export type FraudNodeType =
  | "POLICYHOLDER"
  | "GARAGE"
  | "EXPERT"
  | "LOCATION";

// Actions d'audit pour les réseaux
// Ajout dans le type AuditAction existant :
// | "NETWORK_CREATED"
// | "NETWORK_DISMISSED"
// | "NETWORK_ESCALATED"
// | "NETWORK_RECOMPUTED"
// | "NETWORK_ARCHIVED"

// ─── Nœud du graphe ──────────────────────────────────────────────────────────
export interface FraudNodeItem {
  /** Identifiant unique du nœud (normalizedKey + type) */
  id: string;
  type: FraudNodeType;
  /** Label lisible pour affichage dans D3 */
  label: string;
  /** Clé normalisée (SIRET, "prenom nom", "commune-cp", cuid) */
  normalizedKey: string;
  /** Nombre de sinistres impliquant ce nœud */
  claimCount: number;
  /** Score moyen de fraude des sinistres de ce nœud */
  avgScore: number;
}

// ─── Lien entre deux nœuds ───────────────────────────────────────────────────
export interface FraudLinkItem {
  id: string;
  sourceType: FraudNodeType;
  sourceKey: string;
  sourceLabel: string;
  targetType: FraudNodeType;
  targetKey: string;
  targetLabel: string;
  /** Poids cumulé des co-occurrences (plafonné à 10.0) */
  weight: number;
  /** Nombre de sinistres partagés entre source et cible */
  occurrences: number;
  stale: boolean;
  networkId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Réseau de fraude (liste) ─────────────────────────────────────────────────
export interface FraudNetworkItem {
  id: string;
  status: FraudNetworkStatus;
  risk: FraudNetworkRisk;
  nodeCount: number;
  claimCount: number;
  avgScore: number;
  density: number;
  dismissReason: string | null;
  actionByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

// ─── Réseau de fraude (détail) ────────────────────────────────────────────────
export interface FraudNetworkDetail extends FraudNetworkItem {
  nodes: FraudNodeItem[];
  links: FraudLinkItem[];
  claims: FraudNetworkClaimSummary[];
  audits: FraudNetworkAuditEntry[];
}

export interface FraudNetworkClaimSummary {
  id: string;
  claimNumber: string;
  status: string;
  networkScore: number | null;
  fraudScore: number | null;
  policyholder: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface FraudNetworkAuditEntry {
  id: string;
  action: string;
  userId: string | null;
  createdAt: string;
  metadata: string | null;
}

// ─── Modifications sur ClaimWithRelations existant ───────────────────────────
// Ajouter les champs suivants à l'interface ClaimWithRelations :
//   repairGarage?: string | null;
//   expertName?: string | null;
//   networkScore?: number | null;
//   networkRisk?: FraudNetworkRisk | null;
//   networkId?: string | null;

// ─── Input PATCH action réseau ────────────────────────────────────────────────
export interface FraudNetworkActionInput {
  action: "DISMISS" | "ESCALATE";
  dismissReason?: string;
}
```

---

## 6. Algorithme Union-Find

### Contexte

L'algorithme Union-Find (Disjoint Set Union) regroupe les sinistres en clusters en fonction de leurs nœuds partagés. Chaque cluster devient un `FraudNetwork`.

### Pseudo-code — `fraud-network-service.ts`

```
FONCTION computeFraudNetworks(scope: "FULL" | "INCREMENTAL"):

  // ── Étape 1 : Collecte des sinistres ────────────────────────────────────
  SI scope = "FULL":
    claims ← findMany(Claim, status IN [SUBMITTED, UNDER_REVIEW, INFO_REQUESTED, APPROVED])
  SINON: (INCREMENTAL)
    claims ← findMany(Claim, updatedAt > lastComputedAt)

  // ── Étape 2 : Extraction des nœuds par sinistre ─────────────────────────
  POUR CHAQUE claim:
    nodes[claim.id] ← [
      normalize(POLICYHOLDER, claim.policyholderID),
      normalize(GARAGE,       claim.repairGarage),    // si non null
      normalize(EXPERT,       claim.expertName),      // si non null
      normalize(LOCATION,     claim.incidentLocation) // commune+CP
    ]

  FONCTION normalize(type, raw):
    SI type = GARAGE:      RETOURNER (raw.toUpperCase() + SIRET_si_présent)
    SI type = EXPERT:      RETOURNER (trim + toLowerCase de "prénom nom")
    SI type = LOCATION:    RETOURNER extraireCommune(raw) + "-" + extraireCP(raw)
    SI type = POLICYHOLDER: RETOURNER raw (cuid stable)

  // ── Étape 3 : Union-Find ────────────────────────────────────────────────
  parent ← Map<claimId, claimId>   // chaque sinistre = sa propre racine
  rank   ← Map<claimId, 0>

  FONCTION find(x):
    SI parent[x] ≠ x:
      parent[x] ← find(parent[x])   // compression de chemin
    RETOURNER parent[x]

  FONCTION union(x, y):
    rx, ry ← find(x), find(y)
    SI rx = ry: RETOURNER
    SI rank[rx] < rank[ry]: SWAP(rx, ry)
    parent[ry] ← rx
    SI rank[rx] = rank[ry]: rank[rx]++

  // Deux sinistres sont liés s'ils partagent au moins un nœud normalisé
  nodeIndex ← Map<normalizedKey, claimId[]>   // nœud → liste sinistres
  POUR CHAQUE (claimId, nodeList) DANS nodes:
    POUR CHAQUE node DANS nodeList:
      key ← node.type + ":" + node.normalizedKey
      nodeIndex[key].push(claimId)

  POUR CHAQUE (key, claimIds) DANS nodeIndex:
    SI claimIds.length ≥ 2:
      POUR i DE 1 À claimIds.length - 1:
        union(claimIds[0], claimIds[i])

  // ── Étape 4 : Regroupement en clusters ──────────────────────────────────
  clusters ← Map<rootClaimId, claimId[]>
  POUR CHAQUE claimId:
    root ← find(claimId)
    clusters[root].push(claimId)

  // Filtrer les singletons (1 seul sinistre sans lien)
  clusters ← FILTRER(clusters, taille ≥ 2)

  // ── Étape 5 : Calcul des métriques par cluster ──────────────────────────
  POUR CHAQUE cluster (rootId, claimIds):
    claimsData   ← claims filtrés sur claimIds
    allNodes     ← UNION(nodes[c] POUR c DANS claimIds)  // dédupliqués
    nodeCount    ← |allNodes|
    claimCount   ← |claimIds|
    avgScore     ← MOYENNE(claimsData[c].fraudScore POUR c DANS claimIds, si non null)

    // Calcul densité : arêtes réelles / arêtes max (graphe complet)
    edgesMax     ← nodeCount * (nodeCount - 1) / 2
    edgesActual  ← NombreLiaisonsDistinctes(allNodes, nodeIndex)
    density      ← SI edgesMax > 0: edgesActual / edgesMax SINON 0

    // Classification RG-NET-003
    SI nodeCount ≥ 6 ET claimCount ≥ 5 ET avgScore ≥ 65 ET density ≥ 0.6:
      risk ← "CRITICAL"
    SINON SI nodeCount ≥ 3 ET claimCount ≥ 2 ET avgScore ≥ 40 ET density ≥ 0.3:
      risk ← "SUSPECT"
    SINON:
      CONTINUER (cluster non retenu comme réseau)

    // Calcul networkScore par sinistre (0-100) — RG-NET-004
    POUR CHAQUE claimId DANS cluster:
      claimNodeCount ← |nodes[claimId]|
      // Proportion de nœuds du sinistre présents dans le cluster global
      overlapRatio   ← claimNodeCount / nodeCount
      // Score réseau pondéré par densité et avgScore du cluster
      networkScore   ← MIN(100, ROUND(density * avgScore * overlapRatio * 2))
      claim.networkScore ← networkScore
      claim.networkRisk  ← risk

  // ── Étape 6 : Création/mise à jour des FraudLinks ───────────────────────
  POUR CHAQUE paire (nodeA, nodeB) partageant ≥1 sinistre dans le même cluster:
    occurrences ← NombreSinistresCommuns(nodeA, nodeB)
    weight      ← MIN(10.0, occurrences * POIDS_OCCURRENCE)
    // POIDS_OCCURRENCE ← 0.5 à 1.2 selon types de nœuds impliqués
    // (POLICYHOLDER-GARAGE: 1.2, EXPERT-LOCATION: 0.8, autres: 0.5)
    UPSERT FraudLink(networkId, sourceKey, targetKey, weight, occurrences)

  // ── Étape 7 : Persistance ───────────────────────────────────────────────
  POUR CHAQUE cluster qualifié:
    UPSERT FraudNetwork(metrics, nodesJson)
    UPDATE Claim SET networkId, networkScore, networkRisk
    CREATE FraudNetworkAudit(action: "NETWORK_CREATED" | "NETWORK_RECOMPUTED")

  // Marquer les FraudLinks sans sinistre actif comme stale (RG-NET-010)
  UPDATE FraudLink SET stale=true WHERE networkId NOT IN clustersActifs

  RETOURNER { networksCreated, networksUpdated, claimsLinked }
```

### Injection dans `analyzeFraud()` — RG-NET-005

```
AVANT appel LLM dans analyzeFraud(claimData):
  SI claimData.networkRisk = "CRITICAL":
    claimData.networkBonus ← +35
    claimData.networkContext ← "Sinistre appartenant à un réseau CRITICAL"
  SINON SI claimData.networkRisk = "SUSPECT":
    claimData.networkBonus ← +20
    claimData.networkContext ← "Sinistre appartenant à un réseau SUSPECT"

  score_final ← MIN(100, score_LLM + networkBonus)
```

---

## 7. Tâches par équipe

### Backend (priorité 1)

| # | Fichier cible | Tâche |
|---|---------------|-------|
| B1 | `prisma/schema.prisma` | Ajouter modèles FraudNetwork, FraudLink, FraudNetworkAudit + champs Claim |
| B2 | Migration Prisma | `npx prisma migrate dev --name add_fraud_network_tables` |
| B3 | Migration Prisma | `npx prisma migrate dev --name add_claim_network_fields` |
| B4 | `src/lib/fraud-network-service.ts` | Implémenter `computeFraudNetworks()`, `buildLinks()`, `runUnionFind()`, `scoreNetwork()`, `classifyRisk()`, `normalizeName()`, `scheduleCleanup()` |
| B5 | `src/lib/validations.ts` | Ajouter `FraudNetworkQuerySchema`, `FraudNetworkActionSchema`, `RecomputeSchema` |
| B6 | `src/app/api/fraud-networks/route.ts` | GET liste paginée |
| B7 | `src/app/api/fraud-networks/[id]/route.ts` | GET détail + PATCH action |
| B8 | `src/app/api/fraud-networks/recompute/route.ts` | POST recompute (ADMIN) |
| B9 | `src/middleware.ts` | Ajouter routes `/fraud-networks` et `/api/fraud-networks` |
| B10 | `src/lib/ai-service.ts` | Modifier `analyzeFraud()` pour injecter networkScore/networkRisk |
| B11 | `src/lib/prompts/fraud.ts` | Étendre `fraudUserPrompt()` avec contexte réseau |
| B12 | `src/types/index.ts` | Ajouter tous les types réseau + AuditAction network + champs ClaimWithRelations |

### Frontend (priorité 2, après B6–B8)

| # | Fichier cible | Tâche |
|---|---------------|-------|
| F1 | `src/app/fraud-networks/page.tsx` | Page liste avec filtres statut/risque, pagination |
| F2 | `src/app/fraud-networks/[id]/page.tsx` | Page détail : métriques + graphe + sinistres + audit trail |
| F3 | `src/components/fraud-network/FraudNetworkList.tsx` | Tableau réseaux avec badge risque, lien détail |
| F4 | `src/components/fraud-network/FraudNetworkGraph.tsx` | Graphe D3.js force-directed (nodes colorés par type, edges pondérés) |
| F5 | `src/components/fraud-network/FraudNetworkBadge.tsx` | Badge SUSPECT (orange) / CRITICAL (rouge) / DISMISSED (gris) |
| F6 | `src/components/fraud-network/FraudNetworkActions.tsx` | Boutons Dismiss (modal + raison) / Escalader avec confirmation |
| F7 | Navbar / Dashboard | Ajouter entrée "Réseaux fraude" pour MANAGER/ADMIN |

### IA (priorité 1.5, en parallèle avec Backend B10–B11)

| # | Fichier cible | Tâche |
|---|---------------|-------|
| I1 | `src/lib/prompts/fraud.ts` | Ajouter section réseau dans le prompt système : contexte cluster + bonus score |
| I2 | `src/lib/ai-service.ts` | Lire `networkScore`/`networkRisk` depuis Claim avant appel LLM et les injecter dans `claimData` |
| I3 | `src/lib/fraud-network-service.ts` | Appel à `computeFraudNetworks(INCREMENTAL)` post-`analyzeFraud()` |
| I4 | Cron job | Créer `src/app/api/fraud-networks/cron/route.ts` pour recalcul 02h00 UTC (Vercel Cron ou node-cron) |

---

## 8. Graphe de dépendances

```
Ordre d'implémentation strict :

Phase 0 — Types (déblocage immédiat)
  B12: types/index.ts
    └─ débloque tout le reste

Phase 1 — Schéma + Migrations (base de données)
  B1: schema.prisma
    ├─ B2: migration add_fraud_network_tables
    └─ B3: migration add_claim_network_fields
         └─ débloque B4, B5, B6, B7, B8

Phase 2 — Service principal (logique métier)
  B4: fraud-network-service.ts
    ├─ requiert B1+B2+B3 (modèles Prisma disponibles)
    └─ débloque I3 (appel post-analyzeFraud)

Phase 2 — Validations (en parallèle avec B4)
  B5: validations.ts
    └─ débloque B6, B7, B8

Phase 2 — IA (en parallèle avec B4+B5)
  I1: prompts/fraud.ts
  I2: ai-service.ts
    ├─ requiert B12 (types FraudNetworkRisk)
    └─ requiert B1+B3 (champs Claim.networkScore/networkRisk en BDD)

Phase 3 — Routes API
  B6: /api/fraud-networks/route.ts          (requiert B4+B5)
  B7: /api/fraud-networks/[id]/route.ts     (requiert B4+B5)
  B8: /api/fraud-networks/recompute/route.ts (requiert B4+B5)

Phase 3 — Middleware (en parallèle avec B6–B8)
  B9: middleware.ts                         (requiert B12)

Phase 3 — Cron IA
  I4: api/fraud-networks/cron/route.ts      (requiert B4)

Phase 4 — Frontend (requiert B6+B7+B8 disponibles)
  F5: FraudNetworkBadge.tsx
  F3: FraudNetworkList.tsx                  (requiert F5)
  F4: FraudNetworkGraph.tsx
  F6: FraudNetworkActions.tsx               (requiert F5)
  F1: fraud-networks/page.tsx               (requiert F3+F5)
  F2: fraud-networks/[id]/page.tsx          (requiert F3+F4+F5+F6)
  F7: Navbar                                (requiert F1+F2)

Résumé de la séquence :
  B12 → B1 → B2 → B3 → [B4 ‖ B5 ‖ I1 ‖ I2]
                      → [B6 ‖ B7 ‖ B8 ‖ B9 ‖ I3 ‖ I4]
                      → [F5 → F3 ‖ F4 ‖ F6 → F1 ‖ F2 → F7]
```

---

## 9. Definition of Done

### Fonctionnel

- [ ] Les 3 nouveaux modèles Prisma existent et les migrations sont appliquées
- [ ] Les 5 nouveaux champs Claim existent en base (repairGarage, expertName, networkScore, networkRisk, networkId)
- [ ] `computeFraudNetworks("FULL")` détecte correctement les clusters selon RG-NET-003
- [ ] Normalisation garage (case-insensitive + SIRET), expert (prénom nom), lieu (commune+CP) validée
- [ ] `analyzeFraud()` injecte +20pts (SUSPECT) ou +35pts (CRITICAL) dans le score final
- [ ] `GET /api/fraud-networks` retourne la liste paginée (MANAGER/ADMIN uniquement)
- [ ] `GET /api/fraud-networks/[id]` retourne le détail avec nœuds, liens, sinistres, audit
- [ ] `PATCH /api/fraud-networks/[id]` : Dismiss (→ DISMISSED) et Escalade (→ UNDER_INVESTIGATION) fonctionnent
- [ ] `POST /api/fraud-networks/recompute` déclenche le recalcul complet (ADMIN only)
- [ ] HANDLER voit uniquement networkScore dans la fiche sinistre (pas d'accès aux pages réseau)
- [ ] POLICYHOLDER n'a aucun accès (bloqué par middleware)
- [ ] Audit trail créé sur PATCH et POST recompute
- [ ] FraudLinks orphelins marqués `stale=true`
- [ ] DISMISSED archivés après 1 an (champ archivedAt)

### Technique

- [ ] TypeScript strict : zéro `any`, tous les types définis dans `src/types/index.ts`
- [ ] Zod sur 100% des inputs API (query params + body)
- [ ] Auth vérifiée via `getServerSession()` dans chaque route
- [ ] Middleware mis à jour pour `/fraud-networks` et `/api/fraud-networks`
- [ ] Pagination cohérente avec le reste de l'API (PaginatedResponse<T>)

### Qualité

- [ ] Tests unitaires Vitest pour `fraud-network-service.ts` (Union-Find, scoring, classification)
- [ ] Tests d'intégration pour les 4 routes API (auth, Zod, métier)
- [ ] Couverture ≥ 60% sur les nouveaux fichiers
- [ ] Page liste responsive (mobile/desktop)
- [ ] Graphe D3.js : zoom, pan, tooltip au survol, couleurs par type de nœud
- [ ] Performance : `computeFraudNetworks()` < 5s pour 1 000 sinistres

### Documentation

- [ ] `docs/features/fraude-reseau/architecture.md` créé (ce fichier)
- [ ] JSDoc sur les fonctions publiques de `fraud-network-service.ts`

---

## 10. Résumé JSON pour agents

```json
{
  "feature": "fraude-reseau",
  "version": "1.0",
  "date": "2026-03-08",

  "filesToCreate": [
    "src/app/api/fraud-networks/route.ts",
    "src/app/api/fraud-networks/[id]/route.ts",
    "src/app/api/fraud-networks/recompute/route.ts",
    "src/app/api/fraud-networks/cron/route.ts",
    "src/app/fraud-networks/page.tsx",
    "src/app/fraud-networks/[id]/page.tsx",
    "src/components/fraud-network/FraudNetworkList.tsx",
    "src/components/fraud-network/FraudNetworkGraph.tsx",
    "src/components/fraud-network/FraudNetworkBadge.tsx",
    "src/components/fraud-network/FraudNetworkActions.tsx",
    "src/lib/fraud-network-service.ts"
  ],

  "filesToModify": [
    "prisma/schema.prisma",
    "src/types/index.ts",
    "src/lib/ai-service.ts",
    "src/lib/prompts/fraud.ts",
    "src/lib/validations.ts",
    "src/middleware.ts"
  ],

  "migrations": [
    "add_fraud_network_tables",
    "add_claim_network_fields"
  ],

  "newPrismaModels": ["FraudNetwork", "FraudLink", "FraudNetworkAudit"],

  "newClaimFields": ["repairGarage", "expertName", "networkScore", "networkRisk", "networkId"],

  "newTypes": [
    "FraudNetworkStatus",
    "FraudNetworkRisk",
    "FraudNodeType",
    "FraudNodeItem",
    "FraudLinkItem",
    "FraudNetworkItem",
    "FraudNetworkDetail",
    "FraudNetworkClaimSummary",
    "FraudNetworkAuditEntry",
    "FraudNetworkActionInput"
  ],

  "newAuditActions": [
    "NETWORK_CREATED",
    "NETWORK_DISMISSED",
    "NETWORK_ESCALATED",
    "NETWORK_RECOMPUTED",
    "NETWORK_ARCHIVED"
  ],

  "newZodSchemas": [
    "FraudNetworkQuerySchema",
    "FraudNetworkActionSchema",
    "RecomputeSchema"
  ],

  "apiRoutes": [
    {
      "method": "GET",
      "path": "/api/fraud-networks",
      "auth": ["MANAGER", "ADMIN"],
      "output": "PaginatedResponse<FraudNetworkItem>",
      "audit": false
    },
    {
      "method": "GET",
      "path": "/api/fraud-networks/[id]",
      "auth": ["MANAGER", "ADMIN"],
      "output": "FraudNetworkDetail",
      "audit": false
    },
    {
      "method": "PATCH",
      "path": "/api/fraud-networks/[id]",
      "auth": ["MANAGER", "ADMIN"],
      "input": "FraudNetworkActionSchema",
      "output": "{ id, status, updatedAt }",
      "audit": true,
      "auditActions": ["NETWORK_DISMISSED", "NETWORK_ESCALATED"]
    },
    {
      "method": "POST",
      "path": "/api/fraud-networks/recompute",
      "auth": ["ADMIN"],
      "input": "RecomputeSchema",
      "output": "{ message, networksCreated, networksUpdated, claimsLinked, durationMs }",
      "httpStatus": 202,
      "audit": true,
      "auditActions": ["NETWORK_RECOMPUTED"]
    }
  ],

  "accessControl": {
    "POLICYHOLDER": "aucun accès",
    "HANDLER": "voit uniquement networkScore dans Claim",
    "MANAGER": "liste + détail + PATCH (dismiss/escalate)",
    "ADMIN": "liste + détail + PATCH + POST recompute"
  },

  "algorithm": "Union-Find avec compression de chemin",
  "clusterThresholds": {
    "SUSPECT": { "nodes": 3, "claims": 2, "avgScore": 40, "density": 0.3 },
    "CRITICAL": { "nodes": 6, "claims": 5, "avgScore": 65, "density": 0.6 }
  },

  "aiInjection": {
    "SUSPECT": "+20pts dans fraudScore final",
    "CRITICAL": "+35pts dans fraudScore final",
    "cap": 100
  },

  "nodeWeights": {
    "POLICYHOLDER-GARAGE": 1.2,
    "EXPERT-LOCATION": 0.8,
    "default": 0.5,
    "maxWeight": 10.0
  },

  "recalculationTriggers": [
    "post-analyzeFraud (incremental)",
    "cron 02h00 UTC (full)",
    "POST /api/fraud-networks/recompute (admin, full ou incremental)"
  ],

  "implementationOrder": [
    "B12: types/index.ts",
    "B1: schema.prisma + B2+B3: migrations",
    "B4: fraud-network-service.ts (en parallèle avec B5, I1, I2)",
    "B5: validations.ts",
    "I1: prompts/fraud.ts",
    "I2: ai-service.ts",
    "B6+B7+B8+B9+I3+I4: API routes + middleware + cron",
    "F5+F3+F4+F6: composants",
    "F1+F2+F7: pages + navigation"
  ],

  "testingTargets": [
    "tests/fraud-network-service.test.ts",
    "tests/api/fraud-networks.test.ts",
    "e2e/fraud-networks.spec.ts"
  ],

  "dependencies": {
    "d3": "^7.x (graphe force-directed)",
    "existingDeps": ["prisma", "zod", "next-auth", "tailwindcss"]
  }
}
```
