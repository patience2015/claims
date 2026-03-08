# BA Specs — Fraude Réseau (Network Fraud Detection)

**Feature ID:** fraude-reseau
**Version:** 1.0
**Date:** 2026-03-08
**Auteur:** Agent BA — ClaimFlow AI
**Statut:** Ready for Architecture Review

---

## Table des matières

1. [Contexte & Objectif](#1-contexte--objectif)
2. [Règles métier](#2-règles-métier)
3. [Critères d'acceptation (Gherkin)](#3-critères-dacceptation-gherkin)
4. [Cas limites & edge cases](#4-cas-limites--edge-cases)
5. [Flux métier textuel](#5-flux-métier-textuel)
6. [Impacts sur le modèle de données](#6-impacts-sur-le-modèle-de-données)
7. [JSON structuré](#7-json-structuré)
8. [Résumé exécutif](#8-résumé-exécutif)

---

## 1. Contexte & Objectif

### 1.1 Problème métier

La détection de fraude individuelle (score 0-100 sur chaque sinistre) est déjà en place dans ClaimFlow AI via `analyzeFraud()`. Cependant, les schémas de fraude organisée — dits "fraudes en réseau" — ne peuvent pas être détectés par une analyse sinistre-par-sinistre : ils nécessitent de croiser plusieurs assurés, garages, experts et lieux d'incident pour révéler des **clusters de sinistres statistiquement improbables**.

### 1.2 Objectif

Implémenter un **algorithme de graphe** qui :

1. Modélise les entités (assurés, garages, experts, lieux) comme des **nœuds**
2. Modélise les sinistres partagés comme des **arêtes pondérées** (liens)
3. Détecte automatiquement des **clusters suspects** (composantes connexes à forte densité)
4. Calcule un **score réseau** (0-100) injecté dans `analyzeFraud()` en signal additionnel
5. Expose une **page MANAGER** "Réseaux suspects" avec visualisation D3.js interactive

### 1.3 Personas concernés

| Persona | Rôle | Usage principal |
|---------|------|----------------|
| Marc (Manager) | MANAGER | Consulter les réseaux suspects, déclencher investigations |
| Thomas (Admin) | ADMIN | Configurer les seuils de détection réseau |
| Julie (Gestionnaire) | HANDLER | Voir le score réseau injecté dans la fiche sinistre |
| Système | Automatique | Recalculer les réseaux lors de chaque nouvelle analyse fraude |

---

## 2. Règles métier

### RG-NET-001 — Entités du graphe (nœuds)

Le graphe de fraude réseau comporte 4 types de nœuds :

| Type | Source de données | Identifiant unique |
|------|------------------|--------------------|
| `POLICYHOLDER` | Modèle `Policyholder` | `policyholderId` |
| `GARAGE` | Champ `Claim.repairGarage` (nouveau) | Nom normalisé du garage |
| `EXPERT` | Champ `Claim.expertName` (nouveau) | Nom normalisé de l'expert |
| `LOCATION` | `Claim.incidentLocation` normalisé | Géo-zone (commune + département) |

### RG-NET-002 — Liens entre nœuds (arêtes)

Un lien `FraudLink` est créé entre deux nœuds lorsqu'ils partagent un ou plusieurs sinistres en commun.

| Paire de nœuds | Condition de liaison | Poids initial |
|----------------|---------------------|---------------|
| POLICYHOLDER ↔ POLICYHOLDER | 2+ sinistres au même lieu ou avec le même garage | 1.0 par sinistre commun |
| POLICYHOLDER ↔ GARAGE | Sinistre déclarant ce garage | 0.8 par sinistre |
| POLICYHOLDER ↔ EXPERT | Sinistre avec cet expert | 0.7 par sinistre |
| POLICYHOLDER ↔ LOCATION | Sinistre à ce lieu | 0.5 par sinistre |
| GARAGE ↔ EXPERT | Présents dans le même sinistre | 1.2 par co-occurrence |
| GARAGE ↔ LOCATION | Garage opérant à ce lieu | 0.6 par sinistre |

Le poids total d'un lien = somme des poids par occurrence (plafonné à 10.0).

### RG-NET-003 — Détection de clusters suspects

Un **FraudNetwork** (cluster) est constitué par l'algorithme de composantes connexes (Union-Find / BFS) sur le graphe pondéré filtré.

Critères pour qu'un cluster soit qualifié de **suspect** :

| Critère | Seuil de suspicion | Seuil critique |
|---------|--------------------|----------------|
| Nombre de nœuds dans le cluster | ≥ 3 nœuds | ≥ 6 nœuds |
| Nombre de sinistres impliqués | ≥ 2 sinistres | ≥ 5 sinistres |
| Score moyen fraude individuelle des sinistres | ≥ 40 | ≥ 65 |
| Densité du graphe (arêtes / arêtes max possibles) | ≥ 0.3 | ≥ 0.6 |

Un cluster est **actif** si au moins un sinistre associé est en statut non clos (SUBMITTED, UNDER_REVIEW, INFO_REQUESTED).

### RG-NET-004 — Score réseau (networkScore)

Le `networkScore` est un entier 0-100 calculé pour chaque nœud de type `POLICYHOLDER` et pour chaque `FraudNetwork`.

**Formule pour un sinistre :**

```
networkScore = min(100, Σ contributions)
```

| Contribution | Valeur | Condition |
|-------------|--------|-----------|
| Appartenance à un cluster suspect | +20 pts | cluster.status = SUSPECT |
| Appartenance à un cluster critique | +35 pts | cluster.status = CRITICAL |
| Score fraude moyen du cluster | +10 pts | avgClusterFraudScore ≥ 40 |
| Score fraude moyen du cluster | +15 pts | avgClusterFraudScore ≥ 65 |
| Densité réseau élevée | +10 pts | densité ≥ 0.3 |
| Densité réseau très élevée | +20 pts | densité ≥ 0.6 |
| Garage impliqué dans 5+ sinistres suspects | +15 pts | — |
| Expert impliqué dans 5+ sinistres suspects | +15 pts | — |
| Lieu impliqué dans 3+ sinistres suspects | +10 pts | — |

### RG-NET-005 — Injection dans analyzeFraud()

Lors de l'appel `analyzeFraud(claimData)`, si un `networkScore` existe pour le sinistre, il est ajouté comme indicateur supplémentaire dans `claimData` :

```json
{
  "networkScore": 45,
  "networkRisk": "SUSPECT",
  "networkClusterId": "net_xxx",
  "networkClusterSize": 4,
  "networkClusterSinistres": 3
}
```

Le prompt fraude (`FRAUD_SYSTEM_PROMPT`) est étendu avec un nouvel indicateur :

| Indicateur | Poids | Condition |
|-----------|-------|-----------|
| Appartenance réseau suspect | +20 pts | networkRisk = SUSPECT |
| Appartenance réseau critique | +35 pts | networkRisk = CRITICAL |

### RG-NET-006 — Déclenchement du recalcul réseau

Le graphe est recalculé (ou mis à jour de façon incrémentale) dans les cas suivants :

- Après chaque analyse fraude individuelle (`POST /api/ai/fraud`)
- Après création d'un nouveau sinistre avec `repairGarage` ou `expertName` renseignés
- Manuellement via `POST /api/fraud-networks/recompute` (ADMIN uniquement)
- Recalcul complet planifié : 1x/jour à 02h00 UTC

### RG-NET-007 — Visibilité et accès

| Rôle | Accès page "Réseaux suspects" | Accès API fraud-networks | Modification seuils |
|------|-------------------------------|--------------------------|---------------------|
| HANDLER | Non | Non | Non |
| MANAGER | Oui (lecture) | GET uniquement | Non |
| ADMIN | Oui (lecture + actions) | GET + POST (recompute) | Oui |
| POLICYHOLDER | Non | Non | Non |

### RG-NET-008 — Actions sur un réseau suspect

Depuis la page "Réseaux suspects", un MANAGER peut :

- Consulter le graphe D3.js d'un cluster
- Ouvrir chaque sinistre impliqué depuis le graphe
- Marquer un réseau comme "Faux positif" (status DISMISSED)
- Escalader un réseau vers investigation formelle (status UNDER_INVESTIGATION)
- Ajouter un commentaire interne sur le FraudNetwork

Toute action est tracée dans `AuditLog` avec `entityType = "FRAUD_NETWORK"`.

### RG-NET-009 — Normalisation des entités garage/expert/lieu

- **Garage** : normalisation case-insensitive + suppression ponctuation + SIRET si disponible
- **Expert** : normalisation prénom+nom case-insensitive + numéro agréé si disponible
- **Lieu** : extraction commune + code postal + département (pas de coordonnées GPS requises en v1)

### RG-NET-010 — Conservation et archivage

- Les `FraudNetwork` de status `DISMISSED` sont conservés 1 an puis archivés (soft-delete via `archivedAt`)
- Les `FraudLink` orphelins (plus de sinistres actifs) sont conservés mais marqués `stale = true`

---

## 3. Critères d'acceptation (Gherkin)

```gherkin
Feature: Détection fraude réseau
  En tant que Manager de ClaimFlow AI
  Je veux voir les clusters d'entités suspectes détectés par algorithme de graphe
  Afin d'identifier et d'investiguer les fraudes organisées

  Background:
    Given l'application ClaimFlow AI est démarrée
    And la base de données contient des sinistres avec des entités partagées

  # ──────────────────────────────────────────────
  # Scénario 1 : Création automatique d'un lien réseau
  # ──────────────────────────────────────────────
  Scenario: Création d'un lien réseau après analyse fraude
    Given le sinistre CLM-2026-00042 implique le garage "AutoFix Paris 15"
    And le sinistre CLM-2026-00031 implique aussi le garage "AutoFix Paris 15"
    When l'analyse fraude est déclenchée sur CLM-2026-00042
    Then un FraudLink de type GARAGE est créé entre les deux sinistres
    And la table FraudNetwork est mise à jour avec ce nouveau lien
    And l'audit log contient une entrée "NETWORK_LINK_CREATED"

  # ──────────────────────────────────────────────
  # Scénario 2 : Détection d'un cluster suspect
  # ──────────────────────────────────────────────
  Scenario: Détection automatique d'un cluster suspect (≥ 3 nœuds, ≥ 2 sinistres)
    Given 3 assurés différents ont chacun déclaré un sinistre au même garage
    And le score fraude moyen de ces sinistres est de 55
    When l'algorithme de graphe est exécuté
    Then un FraudNetwork de status "SUSPECT" est créé
    And le FraudNetwork contient exactement 4 nœuds (3 assurés + 1 garage)
    And le networkScore calculé est supérieur ou égal à 30

  # ──────────────────────────────────────────────
  # Scénario 3 : Cluster critique avec expert commun
  # ──────────────────────────────────────────────
  Scenario: Cluster critique détecté via expert + garage communs
    Given 6 sinistres impliquent le même expert agréé "Jean Dupont"
    And 4 de ces sinistres impliquent également le garage "GarageX"
    And le score fraude moyen est 72
    When l'algorithme recalcule le graphe
    Then un FraudNetwork de status "CRITICAL" est créé ou mis à jour
    And le networkScore de chaque assuré impliqué est supérieur ou égal à 55
    And une notification FRAUD_ALERT est envoyée à tous les MANAGER actifs
    And chaque sinistre actif du cluster est escaladé automatiquement vers un manager

  # ──────────────────────────────────────────────
  # Scénario 4 : Injection du score réseau dans analyzeFraud()
  # ──────────────────────────────────────────────
  Scenario: Score réseau injecté dans l'analyse fraude individuelle
    Given le sinistre CLM-2026-00050 appartient à un cluster "SUSPECT" de networkScore 40
    When l'analyse fraude est déclenchée sur CLM-2026-00050
    Then le claimData transmis à analyzeFraud() contient "networkScore": 40
    And le claimData contient "networkRisk": "SUSPECT"
    And le score fraude final intègre +20 pts liés à l'appartenance réseau
    And l'AIAnalysis enregistrée contient le networkScore en inputData

  # ──────────────────────────────────────────────
  # Scénario 5 : Page "Réseaux suspects" — accès MANAGER
  # ──────────────────────────────────────────────
  Scenario: Un MANAGER accède à la page "Réseaux suspects"
    Given l'utilisateur Marc est connecté avec le rôle MANAGER
    When il navigue vers "/fraud-networks"
    Then il voit la liste des FraudNetwork de status SUSPECT et CRITICAL
    And chaque réseau affiche : nombre de nœuds, nombre de sinistres, networkScore moyen, statut
    And les réseaux sont triés par networkScore décroissant
    And les réseaux de status DISMISSED sont masqués par défaut

  # ──────────────────────────────────────────────
  # Scénario 6 : Visualisation graphe D3.js
  # ──────────────────────────────────────────────
  Scenario: Visualisation interactive d'un cluster sur la page graphe
    Given Marc consulte le réseau suspect NET-2026-00003
    When il clique sur "Voir le graphe"
    Then un graphe D3.js force-directed s'affiche
    And les nœuds POLICYHOLDER sont de couleur orange
    And les nœuds GARAGE sont de couleur rouge
    And les nœuds EXPERT sont de couleur violette
    And les nœuds LOCATION sont de couleur bleue
    And les arêtes ont une épaisseur proportionnelle au poids du lien
    And un clic sur un nœud POLICYHOLDER ouvre le panneau latéral avec ses sinistres
    And un clic sur un sinistre dans le panneau navigue vers la fiche sinistre

  # ──────────────────────────────────────────────
  # Scénario 7 : Action — Marquer comme faux positif
  # ──────────────────────────────────────────────
  Scenario: Un MANAGER marque un réseau comme faux positif
    Given Marc consulte le réseau NET-2026-00005 de status SUSPECT
    When il clique sur "Marquer comme faux positif" et confirme
    Then le FraudNetwork passe au status "DISMISSED"
    And le networkScore des sinistres associés est recalculé à 0
    And une entrée AuditLog "NETWORK_DISMISSED" est créée avec userId de Marc
    And le réseau disparaît de la liste par défaut

  # ──────────────────────────────────────────────
  # Scénario 8 : Action — Escalader vers investigation
  # ──────────────────────────────────────────────
  Scenario: Un MANAGER escalade un réseau vers investigation formelle
    Given Marc consulte le réseau NET-2026-00007 de status CRITICAL
    When il clique sur "Escalader" et renseigne une note
    Then le FraudNetwork passe au status "UNDER_INVESTIGATION"
    And tous les sinistres actifs du cluster reçoivent le statut UNDER_REVIEW
    And une notification est envoyée à tous les MANAGER et ADMIN
    And l'audit log contient "NETWORK_ESCALATED" avec la note de Marc

  # ──────────────────────────────────────────────
  # Scénario 9 : Recalcul manuel (ADMIN)
  # ──────────────────────────────────────────────
  Scenario: Un ADMIN déclenche un recalcul complet du graphe
    Given Thomas est connecté avec le rôle ADMIN
    When il appelle POST /api/fraud-networks/recompute
    Then l'algorithme traite l'intégralité des sinistres actifs
    And les FraudNetwork existants sont mis à jour (pas recréés)
    And un rapport de recalcul est retourné : { clustersFound, linksCreated, duration }
    And une entrée AuditLog "NETWORK_RECOMPUTED" est créée

  # ──────────────────────────────────────────────
  # Scénario 10 : Accès refusé à un HANDLER
  # ──────────────────────────────────────────────
  Scenario: Un HANDLER ne peut pas accéder à la page "Réseaux suspects"
    Given Julie est connectée avec le rôle HANDLER
    When elle tente de naviguer vers "/fraud-networks"
    Then elle est redirigée vers "/claims" avec un message "Accès non autorisé"
    And l'appel GET /api/fraud-networks retourne HTTP 403

  # ──────────────────────────────────────────────
  # Scénario 11 : Aucun réseau détecté
  # ──────────────────────────────────────────────
  Scenario: La page affiche un état vide si aucun réseau suspect
    Given aucun FraudNetwork de status SUSPECT ou CRITICAL n'existe
    When Marc navigue vers "/fraud-networks"
    Then il voit le message "Aucun réseau suspect détecté"
    And le graphe D3.js est remplacé par un illustration d'état vide

  # ──────────────────────────────────────────────
  # Scénario 12 : Cluster avec un seul sinistre (non qualifié)
  # ──────────────────────────────────────────────
  Scenario: Un cluster d'un seul sinistre n'est pas créé comme FraudNetwork
    Given un seul sinistre implique le garage "GarageSolo"
    When l'algorithme tourne
    Then aucun FraudNetwork n'est créé pour ce garage isolé
    And le nœud GARAGE est enregistré dans FraudLink mais sans cluster associé
```

---

## 4. Cas limites & edge cases

### EC-001 — Garage avec noms légèrement différents (normalisation)
**Situation :** "Auto Fix Paris 15", "AUTOFIX PARIS 15", "autofix-paris-15" sont le même garage.
**Comportement attendu :** La normalisation produit une clé canonique identique. Un seul nœud GARAGE est créé. Les 3 sinistres sont liés à ce nœud unique.

### EC-002 — Sinistre sans garage ni expert renseigné
**Situation :** Un sinistre de type THEFT ne mentionne ni garage ni expert.
**Comportement attendu :** Seuls les nœuds POLICYHOLDER et LOCATION sont créés. Aucun FraudLink de type GARAGE ou EXPERT n'est généré. Le sinistre peut quand même appartenir à un cluster via les liens LOCATION.

### EC-003 — Assuré avec plusieurs sinistres dans des clusters différents
**Situation :** Le même assuré A appartient au cluster NET-001 (via garage X) et au cluster NET-002 (via lieu Y).
**Comportement attendu :** L'assuré A a des FraudLinks dans les deux clusters. Le networkScore de l'assuré est calculé sur le cluster le plus pénalisant (score maximum).

### EC-004 — Fusion de clusters lors du recalcul
**Situation :** Deux clusters NET-001 et NET-002 étaient distincts. Un nouveau sinistre crée un lien entre eux.
**Comportement attendu :** Les deux clusters fusionnent en un seul FraudNetwork. Les IDs des anciens clusters sont conservés en référence (`mergedFrom`). Un audit log "NETWORK_MERGED" est créé.

### EC-005 — Cluster avec statut DISMISSED puis nouveau sinistre
**Situation :** Un cluster NET-003 a été marqué DISMISSED. Un nouveau sinistre ajoute un lien dans ce cluster.
**Comportement attendu :** Le cluster repasse en statut SUSPECT si les seuils sont dépassés. Une notification est envoyée aux MANAGER. L'historique de DISMISSED est conservé.

### EC-006 — Recalcul concurrent
**Situation :** Deux analyses fraude déclenchent simultanément une mise à jour du graphe.
**Comportement attendu :** Mécanisme de verrou optimiste (version field sur FraudNetwork). La deuxième mise à jour lit l'état après la première.

### EC-007 — Expert avec prénom/nom inversés
**Situation :** "Dupont Jean" vs "Jean Dupont".
**Comportement attendu :** La normalisation tente de déduire prénom/nom. En cas d'ambiguïté, les deux formes créent des nœuds distincts (pas de fusion automatique) — le MANAGER peut les fusionner manuellement.

### EC-008 — Graphe D3.js avec plus de 50 nœuds
**Situation :** Un cluster très large avec 60+ nœuds ralentit le rendu.
**Comportement attendu :** Limitation du rendu à 50 nœuds (les plus connectés). Un message indique "Cluster trop large — affichage des 50 nœuds les plus connectés". L'export CSV de la liste complète reste disponible.

### EC-009 — Sinistre supprimé (soft-delete futur)
**Situation :** Si un sinistre est archivé, les FraudLinks associés doivent être invalidés.
**Comportement attendu :** Les FraudLinks passent à `stale = true`. Le cluster est recalculé. Si en dessous des seuils, le FraudNetwork passe à INACTIVE.

### EC-010 — Aucune donnée historique (premier sinistre du système)
**Situation :** La base est vide, le premier sinistre est créé.
**Comportement attendu :** L'algorithme de graphe ne crée aucun FraudNetwork. Le networkScore retourné est 0. Aucune erreur.

---

## 5. Flux métier textuel

### Flux 1 — Analyse fraude avec injection réseau (chemin nominal)

```
1. Un gestionnaire déclenche l'analyse fraude sur le sinistre CLM-2026-00099
2. La route POST /api/ai/fraud reçoit la requête (auth + Zod validés)
3. Le service fraud-network-service.ts calcule le networkScore pour ce sinistre :
   a. Récupère les entités du sinistre : policyholderId, repairGarage, expertName, incidentLocation
   b. Cherche les FraudNetwork existants contenant ces entités
   c. Calcule le networkScore selon RG-NET-004
4. Le networkScore est injecté dans claimData avant l'appel analyzeFraud()
5. Le prompt fraude inclut l'indicateur "Appartenance réseau suspect" si applicable
6. analyzeFraud() retourne { score, risk, factors, summary, recommendation }
7. Le graphe est mis à jour de façon incrémentale :
   a. Création/mise à jour des nœuds FraudLink pour ce sinistre
   b. Réévaluation des clusters impactés
   c. Si nouveau cluster qualifié SUSPECT : notification MANAGER
   d. Si nouveau cluster qualifié CRITICAL : notification + escalade automatique
8. Le Claim est mis à jour avec fraudScore, fraudRisk, networkScore
9. L'AIAnalysis est enregistrée avec inputData incluant networkScore
10. L'AuditLog trace l'action AI_ANALYSIS_RUN + NETWORK_UPDATED
11. La réponse JSON est retournée au frontend
```

### Flux 2 — Consultation de la page "Réseaux suspects" (MANAGER)

```
1. Marc (MANAGER) navigue vers /fraud-networks
2. Le middleware vérifie le rôle (MANAGER ou ADMIN requis) → accès accordé
3. La page charge GET /api/fraud-networks?status=SUSPECT,CRITICAL&sort=score_desc
4. La liste des FraudNetwork qualifiés est affichée en cards :
   - Identifiant réseau (NET-YYYY-NNNNN)
   - Statut (SUSPECT / CRITICAL / UNDER_INVESTIGATION)
   - Nombre de nœuds / sinistres
   - networkScore moyen
   - Date de création / dernière mise à jour
5. Marc clique sur un réseau → page détail /fraud-networks/[id]
6. L'API GET /api/fraud-networks/[id] retourne nœuds + liens + sinistres
7. Le graphe D3.js force-directed se charge avec les nœuds et arêtes
8. Marc interagit avec le graphe (hover, clic nœud, clic sinistre)
9. Marc choisit une action : "Faux positif" ou "Escalader"
10. La confirmation modal apparaît (action irréversible sauf DISMISSED → SUSPECT)
11. L'API PATCH /api/fraud-networks/[id] met à jour le statut
12. L'AuditLog trace l'action (NETWORK_DISMISSED ou NETWORK_ESCALATED)
13. La liste est rechargée et le réseau disparaît ou change de badge
```

### Flux 3 — Recalcul complet planifié (système)

```
1. À 02h00 UTC chaque nuit, un job (ou appel CRON externe) appelle POST /api/fraud-networks/recompute
2. L'algorithme charge tous les sinistres non archivés avec leurs entités
3. Construction du graphe complet en mémoire (adjacency list)
4. Algorithme Union-Find pour détecter les composantes connexes
5. Calcul du score et statut de chaque composante selon RG-NET-003
6. Comparaison avec les FraudNetwork existants :
   - Mise à jour si le cluster existe (score, nœuds, sinistres)
   - Création si le cluster est nouveau
   - Fusion si deux clusters fusionnent (EC-004)
   - Passage en INACTIVE si un cluster descend sous les seuils
7. Notification groupée des nouveaux clusters CRITICAL aux MANAGER
8. Rapport de recalcul retourné et audité
```

---

## 6. Impacts sur le modèle de données

### 6.1 Nouveaux modèles Prisma

#### Modèle `FraudNetwork`

```prisma
model FraudNetwork {
  id              String   @id @default(cuid())
  networkNumber   String   @unique          // NET-YYYY-NNNNN
  status          String   @default("SUSPECT") // SUSPECT | CRITICAL | UNDER_INVESTIGATION | DISMISSED | INACTIVE
  networkScore    Int      @default(0)      // 0-100, score global du cluster
  nodeCount       Int      @default(0)      // nombre de nœuds
  claimCount      Int      @default(0)      // nombre de sinistres impliqués
  avgFraudScore   Float    @default(0)      // score fraude moyen des sinistres
  density         Float    @default(0)      // densité du graphe (0-1)
  mergedFrom      String?                   // JSON array d'IDs si fusion de clusters
  notes           String?                   // commentaire interne MANAGER
  archivedAt      DateTime?                 // soft-delete

  links           FraudLink[]
  auditLogs       FraudNetworkAudit[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status])
  @@index([networkScore])
}
```

#### Modèle `FraudLink`

```prisma
model FraudLink {
  id              String   @id @default(cuid())
  networkId       String
  network         FraudNetwork @relation(fields: [networkId], references: [id])

  // Nœud source
  sourceType      String   // POLICYHOLDER | GARAGE | EXPERT | LOCATION
  sourceId        String   // ID ou clé normalisée selon sourceType
  sourceLabel     String   // Label affiché dans le graphe

  // Nœud cible
  targetType      String   // POLICYHOLDER | GARAGE | EXPERT | LOCATION
  targetId        String   // ID ou clé normalisée selon targetType
  targetLabel     String   // Label affiché dans le graphe

  weight          Float    @default(1.0)   // poids du lien (0-10)
  claimIds        String                   // JSON array des claimIds communs
  stale           Boolean  @default(false) // true si sinistres associés archivés

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([networkId])
  @@index([sourceType, sourceId])
  @@index([targetType, targetId])
  @@unique([networkId, sourceType, sourceId, targetType, targetId])
}
```

#### Modèle `FraudNetworkAudit`

```prisma
model FraudNetworkAudit {
  id              String   @id @default(cuid())
  networkId       String
  network         FraudNetwork @relation(fields: [networkId], references: [id])
  action          String   // NETWORK_CREATED | NETWORK_UPDATED | NETWORK_DISMISSED | NETWORK_ESCALATED | NETWORK_MERGED | NETWORK_RECOMPUTED | NETWORK_LINK_CREATED
  before          String?  // JSON
  after           String?  // JSON
  metadata        String?  // JSON : { reason, userId, claimIds... }
  userId          String?  // null si action système automatique
  createdAt       DateTime @default(now())

  @@index([networkId])
  @@index([action])
}
```

### 6.2 Nouveaux champs sur modèles existants

#### Modèle `Claim` — champs additionnels

```prisma
// Ajouts sur le modèle Claim existant :
repairGarage    String?  // Nom du garage de réparation déclaré
expertName      String?  // Nom de l'expert agréé missionné
networkScore    Int?     // Score réseau injecté (0-100)
networkRisk     String?  // NONE | SUSPECT | CRITICAL
networkId       String?  // FK vers FraudNetwork si appartenance détectée
```

#### Modèle `Notification` — nouveau type

```
// Ajout du type dans les valeurs acceptées :
type: "NETWORK_FRAUD_ALERT"  // Nouveau cluster CRITICAL détecté
type: "NETWORK_ESCALATED"    // Réseau escaladé vers investigation
```

#### Modèle `AuditLog` — nouveaux types d'action

```
// Ajouts dans les valeurs d'action :
action: "NETWORK_LINK_CREATED"    // Lien réseau créé après analyse fraude
action: "NETWORK_DISMISSED"       // Réseau marqué faux positif
action: "NETWORK_ESCALATED"       // Réseau escaladé
action: "NETWORK_MERGED"          // Deux clusters fusionnés
action: "NETWORK_RECOMPUTED"      // Recalcul complet déclenché
```

### 6.3 Migrations requises

| Migration | Description | Type |
|-----------|-------------|------|
| `add_fraud_network_tables` | Création FraudNetwork + FraudLink + FraudNetworkAudit | Additive |
| `add_claim_network_fields` | Ajout repairGarage, expertName, networkScore, networkRisk, networkId sur Claim | Additive |

Les deux migrations sont **additives** (aucune donnée existante modifiée). Elles peuvent être appliquées en un seul batch ou séquentiellement.

### 6.4 Services à créer ou modifier

| Service | Fichier | Action |
|---------|---------|--------|
| `fraud-network-service.ts` | `src/lib/fraud-network-service.ts` | Créer — logique graphe + clustering |
| `ai-service.ts` | `src/lib/ai-service.ts` | Modifier — injection networkScore dans analyzeFraud() |
| `prompts/fraud.ts` | `src/lib/prompts/fraud.ts` | Modifier — ajout indicateur réseau dans FRAUD_INDICATORS |
| `claim-service.ts` | `src/lib/claim-service.ts` | Modifier — checkFraudEscalation inclut clusters CRITICAL |
| `permissions.ts` | `src/lib/permissions.ts` | Modifier — canViewFraudNetworks, canManageFraudNetworks |
| `validations.ts` | `src/lib/validations.ts` | Modifier — schémas Zod pour fraud-networks API |

### 6.5 Routes API à créer

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/fraud-networks` | MANAGER, ADMIN | Liste des réseaux suspects paginée + filtrée |
| GET | `/api/fraud-networks/[id]` | MANAGER, ADMIN | Détail d'un réseau + nœuds + liens |
| PATCH | `/api/fraud-networks/[id]` | MANAGER, ADMIN | Mise à jour statut (dismiss / escalate) |
| POST | `/api/fraud-networks/recompute` | ADMIN | Déclenche recalcul complet |

### 6.6 Pages frontend à créer

| Route | Composant | Auth | Description |
|-------|-----------|------|-------------|
| `/fraud-networks` | `FraudNetworksList` | MANAGER, ADMIN | Liste + filtres + résumé stats |
| `/fraud-networks/[id]` | `FraudNetworkDetail` | MANAGER, ADMIN | Graphe D3.js + liste sinistres + actions |

---

## 7. JSON structuré

```json
{
  "feature": "fraude-reseau",
  "version": "1.0",
  "date": "2026-03-08",
  "status": "ready-for-architecture",
  "personas": [
    {
      "id": "manager",
      "name": "Marc",
      "role": "MANAGER",
      "primaryActions": ["consulter réseaux suspects", "visualiser graphe D3.js", "marquer faux positif", "escalader réseau"],
      "accessLevel": "lecture + actions sur FraudNetwork"
    },
    {
      "id": "admin",
      "name": "Thomas",
      "role": "ADMIN",
      "primaryActions": ["déclencher recalcul complet", "configurer seuils", "toutes actions MANAGER"],
      "accessLevel": "complet"
    },
    {
      "id": "handler",
      "name": "Julie",
      "role": "HANDLER",
      "primaryActions": ["voir networkScore dans la fiche sinistre"],
      "accessLevel": "lecture seule sur networkScore dans Claim"
    },
    {
      "id": "system",
      "name": "Système automatique",
      "role": "SYSTEM",
      "primaryActions": ["recalcul nocturne", "injection networkScore", "notifications automatiques"],
      "accessLevel": "service interne"
    }
  ],
  "businessRules": [
    {
      "id": "RG-NET-001",
      "title": "Entités du graphe (nœuds)",
      "description": "4 types de nœuds : POLICYHOLDER, GARAGE, EXPERT, LOCATION",
      "priority": "MUST"
    },
    {
      "id": "RG-NET-002",
      "title": "Liens entre nœuds (arêtes pondérées)",
      "description": "FraudLink créé pour chaque paire d'entités partageant un sinistre, avec poids selon type de paire",
      "priority": "MUST"
    },
    {
      "id": "RG-NET-003",
      "title": "Détection de clusters suspects",
      "description": "Algorithme Union-Find/BFS sur graphe pondéré. Seuils : ≥3 nœuds ET ≥2 sinistres ET avgFraudScore ≥40 ET densité ≥0.3",
      "priority": "MUST"
    },
    {
      "id": "RG-NET-004",
      "title": "Calcul du score réseau (networkScore)",
      "description": "Score 0-100 per sinistre basé sur appartenance cluster, statut cluster, densité, garage/expert/lieu récurrents",
      "priority": "MUST"
    },
    {
      "id": "RG-NET-005",
      "title": "Injection networkScore dans analyzeFraud()",
      "description": "networkScore injecté dans claimData avant appel LLM. Nouvel indicateur +20pts (SUSPECT) ou +35pts (CRITICAL) dans le prompt",
      "priority": "MUST"
    },
    {
      "id": "RG-NET-006",
      "title": "Déclenchement du recalcul",
      "description": "Recalcul incrémental après chaque analyse fraude. Recalcul complet planifié 1x/jour 02h00 UTC. Recalcul manuel ADMIN",
      "priority": "MUST"
    },
    {
      "id": "RG-NET-007",
      "title": "Contrôle d'accès",
      "description": "Page et API réservées MANAGER + ADMIN. HANDLER voit uniquement networkScore dans Claim. POLICYHOLDER : aucun accès",
      "priority": "MUST"
    },
    {
      "id": "RG-NET-008",
      "title": "Actions MANAGER sur réseau",
      "description": "Dismiss (→DISMISSED) ou Escalade (→UNDER_INVESTIGATION) depuis la page détail. Toutes les actions auditées",
      "priority": "MUST"
    },
    {
      "id": "RG-NET-009",
      "title": "Normalisation entités",
      "description": "Garage : case-insensitive + dépunctuation + SIRET. Expert : prénom+nom normalisés. Lieu : commune + code postal",
      "priority": "MUST"
    },
    {
      "id": "RG-NET-010",
      "title": "Conservation et archivage",
      "description": "FraudNetwork DISMISSED archivés après 1 an. FraudLink orphelins marqués stale=true",
      "priority": "SHOULD"
    }
  ],
  "acceptanceCriteria": [
    {
      "id": "AC-001",
      "scenario": "Création lien réseau après analyse fraude",
      "given": "Deux sinistres partagent le même garage",
      "when": "Analyse fraude déclenchée sur l'un d'eux",
      "then": "FraudLink créé + FraudNetwork mis à jour + AuditLog NETWORK_LINK_CREATED"
    },
    {
      "id": "AC-002",
      "scenario": "Détection cluster suspect ≥3 nœuds",
      "given": "3 assurés au même garage, avgFraudScore=55",
      "when": "Algorithme graphe exécuté",
      "then": "FraudNetwork status=SUSPECT, 4 nœuds, networkScore ≥30"
    },
    {
      "id": "AC-003",
      "scenario": "Cluster critique expert+garage, escalade auto",
      "given": "6 sinistres / même expert / avgFraudScore=72",
      "when": "Recalcul graphe",
      "then": "FraudNetwork status=CRITICAL, networkScore ≥55, notification FRAUD_ALERT MANAGER, escalade sinistres actifs"
    },
    {
      "id": "AC-004",
      "scenario": "Injection networkScore dans analyzeFraud()",
      "given": "Sinistre appartient à cluster SUSPECT networkScore=40",
      "when": "Analyse fraude déclenchée",
      "then": "claimData contient networkScore:40 et networkRisk:SUSPECT, score final +20pts, AIAnalysis contient networkScore"
    },
    {
      "id": "AC-005",
      "scenario": "Accès MANAGER page réseaux suspects",
      "given": "Marc connecté MANAGER",
      "when": "Navigation /fraud-networks",
      "then": "Liste SUSPECT+CRITICAL triée score desc, DISMISSED masqués par défaut"
    },
    {
      "id": "AC-006",
      "scenario": "Visualisation D3.js interactive",
      "given": "Marc consulte NET-2026-00003",
      "when": "Clic Voir le graphe",
      "then": "Graphe force-directed, couleurs par type nœud, épaisseur arête = poids, clic nœud → panneau sinistres"
    },
    {
      "id": "AC-007",
      "scenario": "Marquer faux positif",
      "given": "Marc sur réseau SUSPECT",
      "when": "Clic Faux positif + confirmation",
      "then": "Status→DISMISSED, networkScore sinistres→0, AuditLog NETWORK_DISMISSED, réseau masqué"
    },
    {
      "id": "AC-008",
      "scenario": "Escalade vers investigation",
      "given": "Marc sur réseau CRITICAL",
      "when": "Clic Escalader + note",
      "then": "Status→UNDER_INVESTIGATION, sinistres actifs→UNDER_REVIEW, notification MANAGER+ADMIN, AuditLog NETWORK_ESCALATED"
    },
    {
      "id": "AC-009",
      "scenario": "Recalcul manuel ADMIN",
      "given": "Thomas connecté ADMIN",
      "when": "POST /api/fraud-networks/recompute",
      "then": "Tous sinistres traités, FraudNetwork mis à jour (pas recréés), rapport {clustersFound, linksCreated, duration}, AuditLog NETWORK_RECOMPUTED"
    },
    {
      "id": "AC-010",
      "scenario": "Accès refusé HANDLER",
      "given": "Julie connectée HANDLER",
      "when": "Navigation /fraud-networks ou GET /api/fraud-networks",
      "then": "Redirection /claims + message, HTTP 403 sur API"
    },
    {
      "id": "AC-011",
      "scenario": "État vide si aucun réseau suspect",
      "given": "Aucun FraudNetwork SUSPECT ou CRITICAL",
      "when": "Marc navigue /fraud-networks",
      "then": "Message 'Aucun réseau suspect détecté' + illustration état vide, pas de graphe"
    },
    {
      "id": "AC-012",
      "scenario": "Cluster d'un seul sinistre non qualifié",
      "given": "Un seul sinistre pour un garage isolé",
      "when": "Algorithme tourne",
      "then": "Aucun FraudNetwork créé, nœud GARAGE dans FraudLink sans cluster associé"
    }
  ],
  "edgeCases": [
    {
      "id": "EC-001",
      "title": "Normalisation noms de garages",
      "risk": "MEDIUM",
      "mitigation": "Normalisation case-insensitive + suppression ponctuation + SIRET prioritaire"
    },
    {
      "id": "EC-002",
      "title": "Sinistre sans garage/expert",
      "risk": "LOW",
      "mitigation": "Seuls les liens POLICYHOLDER+LOCATION sont créés. Pas d'erreur."
    },
    {
      "id": "EC-003",
      "title": "Assuré dans plusieurs clusters",
      "risk": "MEDIUM",
      "mitigation": "networkScore = max des scores des clusters auxquels l'assuré appartient"
    },
    {
      "id": "EC-004",
      "title": "Fusion de clusters",
      "risk": "HIGH",
      "mitigation": "mergedFrom JSON array, AuditLog NETWORK_MERGED, IDs anciens clusters référencés"
    },
    {
      "id": "EC-005",
      "title": "Cluster DISMISSED réactivé",
      "risk": "MEDIUM",
      "mitigation": "Si seuils dépassés après nouveau sinistre → repasse SUSPECT + notification MANAGER"
    },
    {
      "id": "EC-006",
      "title": "Recalcul concurrent",
      "risk": "HIGH",
      "mitigation": "Verrou optimiste (version field sur FraudNetwork), retry si conflit détecté"
    },
    {
      "id": "EC-007",
      "title": "Expert prénom/nom inversés",
      "risk": "LOW",
      "mitigation": "Deux nœuds distincts si ambiguïté — fusion manuelle possible par MANAGER (v2)"
    },
    {
      "id": "EC-008",
      "title": "Graphe D3.js >50 nœuds",
      "risk": "MEDIUM",
      "mitigation": "Limitation affichage 50 nœuds les plus connectés + message + export CSV liste complète"
    },
    {
      "id": "EC-009",
      "title": "Sinistre archivé / supprimé",
      "risk": "MEDIUM",
      "mitigation": "FraudLinks associés → stale=true. Recalcul cluster. Si sous seuils → INACTIVE"
    },
    {
      "id": "EC-010",
      "title": "Premier sinistre du système",
      "risk": "LOW",
      "mitigation": "Algorithme ne crée aucun FraudNetwork. networkScore=0. Aucune erreur."
    }
  ],
  "dataImpacts": {
    "newModels": [
      {
        "name": "FraudNetwork",
        "fields": ["id", "networkNumber", "status", "networkScore", "nodeCount", "claimCount", "avgFraudScore", "density", "mergedFrom", "notes", "archivedAt", "createdAt", "updatedAt"],
        "relations": ["FraudLink[]", "FraudNetworkAudit[]"]
      },
      {
        "name": "FraudLink",
        "fields": ["id", "networkId", "sourceType", "sourceId", "sourceLabel", "targetType", "targetId", "targetLabel", "weight", "claimIds", "stale", "createdAt", "updatedAt"],
        "relations": ["FraudNetwork"]
      },
      {
        "name": "FraudNetworkAudit",
        "fields": ["id", "networkId", "action", "before", "after", "metadata", "userId", "createdAt"],
        "relations": ["FraudNetwork"]
      }
    ],
    "newFields": [
      {
        "model": "Claim",
        "fields": ["repairGarage (String?)", "expertName (String?)", "networkScore (Int?)", "networkRisk (String?)", "networkId (String?)"]
      },
      {
        "model": "Notification",
        "newTypes": ["NETWORK_FRAUD_ALERT", "NETWORK_ESCALATED"]
      },
      {
        "model": "AuditLog",
        "newActions": ["NETWORK_LINK_CREATED", "NETWORK_DISMISSED", "NETWORK_ESCALATED", "NETWORK_MERGED", "NETWORK_RECOMPUTED"]
      }
    ],
    "migrations": [
      {
        "name": "add_fraud_network_tables",
        "type": "additive",
        "description": "Création des tables FraudNetwork, FraudLink, FraudNetworkAudit",
        "breaking": false
      },
      {
        "name": "add_claim_network_fields",
        "type": "additive",
        "description": "Ajout repairGarage, expertName, networkScore, networkRisk, networkId sur Claim",
        "breaking": false
      }
    ],
    "apiRoutes": [
      { "method": "GET", "path": "/api/fraud-networks", "auth": ["MANAGER", "ADMIN"], "description": "Liste paginée + filtrée" },
      { "method": "GET", "path": "/api/fraud-networks/[id]", "auth": ["MANAGER", "ADMIN"], "description": "Détail réseau + nœuds + liens" },
      { "method": "PATCH", "path": "/api/fraud-networks/[id]", "auth": ["MANAGER", "ADMIN"], "description": "Dismiss ou Escalade" },
      { "method": "POST", "path": "/api/fraud-networks/recompute", "auth": ["ADMIN"], "description": "Recalcul complet graphe" }
    ],
    "frontendPages": [
      { "route": "/fraud-networks", "component": "FraudNetworksList", "auth": ["MANAGER", "ADMIN"] },
      { "route": "/fraud-networks/[id]", "component": "FraudNetworkDetail", "auth": ["MANAGER", "ADMIN"] }
    ],
    "servicesToCreate": [
      "src/lib/fraud-network-service.ts"
    ],
    "servicesToModify": [
      "src/lib/ai-service.ts",
      "src/lib/prompts/fraud.ts",
      "src/lib/claim-service.ts",
      "src/lib/permissions.ts",
      "src/lib/validations.ts"
    ]
  },
  "technicalConstraints": [
    "TypeScript strict — zéro any",
    "Zod sur 100% des entrées API",
    "Audit trail sur toutes les mutations FraudNetwork",
    "Algorithm de graphe : Union-Find (O(α·n)) pour la détection de composantes connexes",
    "D3.js force-directed graph avec simulation physique",
    "Limitation rendu D3.js à 50 nœuds max pour la performance",
    "Verrou optimiste sur FraudNetwork pour éviter les conflits de recalcul concurrent",
    "Numérotation réseaux : NET-YYYY-NNNNN (même pattern que CLM-YYYY-NNNNN)"
  ]
}
```

---

## 8. Résumé exécutif

### Objectif
Étendre le pipeline de détection de fraude de ClaimFlow AI avec une capacité de **détection de fraude réseau** (fraudes organisées / ring fraud), invisible à l'analyse sinistre-par-sinistre.

### Valeur métier
- Détection de schémas impossibles à identifier individuellement : anneaux de garages, experts complaisants, lieux récurrents suspects
- Score réseau injecté dans `analyzeFraud()` pour enrichir le score fraude existant sans le remplacer
- Interface MANAGER dédiée avec graphe interactif D3.js pour une investigation visuelle et intuitive

### Périmètre technique
| Composant | Volume |
|-----------|--------|
| Nouveaux modèles Prisma | 3 (FraudNetwork, FraudLink, FraudNetworkAudit) |
| Nouveaux champs sur Claim | 5 (repairGarage, expertName, networkScore, networkRisk, networkId) |
| Nouvelles routes API | 4 |
| Nouvelles pages frontend | 2 |
| Services créés | 1 (fraud-network-service.ts) |
| Services modifiés | 5 |
| Migrations Prisma | 2 (additives, non-breaking) |

### Risques identifiés
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance recalcul graphe sur large dataset | MEDIUM | HIGH | Recalcul incrémental + batch nocturne |
| Faux positifs élevés sur normalisation garage | MEDIUM | MEDIUM | Seuils configurables + action DISMISSED |
| Rendu D3.js lent sur clusters > 50 nœuds | HIGH | MEDIUM | Limitation affichage + export CSV |
| Concurrence recalcul | LOW | HIGH | Verrou optimiste sur FraudNetwork |

### Dépendances
- **Aucune dépendance externe nouvelle** : D3.js (ajout npm), algorithme Union-Find implémenté en TypeScript natif
- **Dépendances internes** : `analyzeFraud()`, `checkFraudEscalation()`, `createAuditLog()`, `createNotification()` — toutes existantes

### DoD (Definition of Done)
- [ ] 2 migrations Prisma additives appliquées et testées
- [ ] `fraud-network-service.ts` avec algorithme Union-Find + calcul networkScore
- [ ] `analyzeFraud()` injecte le networkScore si disponible
- [ ] Prompt fraude étendu avec indicateur réseau
- [ ] 4 routes API avec auth + Zod + audit
- [ ] Page `/fraud-networks` avec liste + stats
- [ ] Page `/fraud-networks/[id]` avec graphe D3.js force-directed interactif
- [ ] Tests Vitest : service graphe + routes API (coverage ≥ 60%)
- [ ] Test E2E Playwright : flux MANAGER consultation + action dismiss
- [ ] Aucun accès HANDLER ou POLICYHOLDER aux endpoints réseau (testé)
