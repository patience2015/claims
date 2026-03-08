# BA Specifications — Portail Assuré Self-Service

**Feature :** `portail-assure-self-service`
**Version :** 1.0
**Date :** Mars 2026
**Statut :** Implémenté ✅
**Priorité :** P1

---

## 1. Contexte & Valeur métier

L'assuré était absent en tant qu'acteur dans ClaimFlow AI : il existait comme fiche (`Policyholder`) mais ne pouvait pas se connecter, suivre son dossier, ni agir directement. Tout passait par le gestionnaire, créant un goulot d'étranglement et une mauvaise expérience client.

**Impact attendu :** réduction de 40 % des appels support entrants.

---

## 2. Personas

| Persona | Description | Droits |
|---------|-------------|--------|
| **POLICYHOLDER** | Assuré titulaire d'un contrat | Lecture seule de ses sinistres, upload documents, décision indemnisation |
| **HANDLER** | Gestionnaire sinistres | Inchangé |
| **MANAGER** | Responsable équipe | Inchangé |
| **ADMIN** | Administrateur | Inchangé |

---

## 3. Règles métier

| # | Règle | Priorité |
|---|-------|----------|
| BR-01 | L'assuré s'authentifie avec son numéro de police + email (pas de mot de passe) | MUST |
| BR-02 | La session POLICYHOLDER dure 4h (vs 8h pour les agents internes) | MUST |
| BR-03 | L'assuré ne voit que ses propres sinistres (isolation par `policyholderID`) | MUST |
| BR-04 | Le score de fraude n'est jamais exposé côté portail | MUST |
| BR-05 | L'upload de documents est autorisé uniquement pour les statuts `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED` | MUST |
| BR-06 | La décision (accepter/refuser) n'est possible que si `status = APPROVED` ET `approvedAmount != null` | MUST |
| BR-07 | Le motif de refus doit contenir au minimum 20 caractères | MUST |
| BR-08 | Accepter ou refuser une proposition ferme le sinistre (`status = CLOSED`) | MUST |
| BR-09 | Le motif de clôture est tracé en base (`closureReason`) | MUST |
| BR-10 | Formats documents acceptés : PDF, JPG, PNG — taille max 5 Mo | MUST |
| BR-11 | Chaque action est auditée (`DOCUMENT_UPLOADED_BY_POLICYHOLDER`, `CLAIM_ACCEPTED`, `CLAIM_REJECTED_BY_POLICYHOLDER`) | MUST |
| BR-12 | Un User de rôle POLICYHOLDER est créé automatiquement à la première connexion, lié au Policyholder via `userId` | MUST |
| BR-13 | Si le paire (policyNumber, email) n'existe pas en base, la connexion échoue silencieusement (pas de message d'erreur détaillé) | MUST |
| BR-14 | Les POLICYHOLDERs ne peuvent accéder qu'aux routes `/portail/*` et `/api/portail/*` | MUST |

---

## 4. Critères d'acceptation (Gherkin)

```gherkin
Feature: Portail Assuré Self-Service

  # --- Authentification ---

  Scenario: Connexion réussie avec numéro de police et email valides
    Given l'assuré Marie Dupont a le numéro de police "POL-2024-001"
    And son email est "marie.dupont@email.fr"
    When elle saisit ces identifiants sur /portail/login
    Then elle est redirigée vers /portail/mes-sinistres
    And sa session dure 4 heures

  Scenario: Connexion échouée avec mauvais identifiants
    Given un assuré saisit "POL-INCONNU" et "inconnu@email.fr"
    When il valide le formulaire
    Then un message d'erreur générique s'affiche
    And aucune session n'est créée

  Scenario: Accès refusé aux routes internes
    Given l'assuré est connecté avec le rôle POLICYHOLDER
    When il tente d'accéder à /claims
    Then il est redirigé vers /portail/mes-sinistres

  # --- Liste des sinistres ---

  Scenario: Affichage de la liste des sinistres de l'assuré
    Given l'assuré est connecté
    When il accède à /portail/mes-sinistres
    Then il voit uniquement ses propres sinistres
    And chaque sinistre affiche : numéro, statut, type, date, montants si disponibles

  Scenario: Aucun sinistre pour l'assuré
    Given l'assuré n'a aucun sinistre enregistré
    When il accède à /portail/mes-sinistres
    Then un message "Aucun sinistre déclaré" s'affiche

  # --- Détail sinistre ---

  Scenario: Consultation du détail d'un sinistre
    Given l'assuré a un sinistre CLM-2026-00001
    When il clique dessus
    Then il voit : description, date, lieu, type, documents, montants
    And le score de fraude n'est PAS affiché

  Scenario: Accès refusé au sinistre d'un autre assuré
    Given l'assuré Marie est connectée
    When elle tente d'accéder au sinistre de Jean via l'URL
    Then elle reçoit une erreur 403

  # --- Upload de documents ---

  Scenario: Upload d'un document sur un sinistre INFO_REQUESTED
    Given le sinistre est en statut INFO_REQUESTED
    When l'assuré uploade un fichier PDF de 2 Mo
    Then le document est enregistré en base
    And un audit log DOCUMENT_UPLOADED_BY_POLICYHOLDER est créé
    And le document apparaît dans la liste

  Scenario: Upload refusé sur un sinistre CLOSED
    Given le sinistre est en statut CLOSED
    When l'assuré tente d'uploader un document
    Then il reçoit une erreur 400 "Upload non disponible pour ce statut"

  Scenario: Upload refusé si fichier trop volumineux
    Given l'assuré tente d'uploader un fichier de 6 Mo
    Then il reçoit une erreur 400 "Fichier trop volumineux (max 5 Mo)"

  Scenario: Upload refusé si format non autorisé
    Given l'assuré tente d'uploader un fichier .docx
    Then il reçoit une erreur 400 "Format non autorisé (PDF, JPG, PNG uniquement)"

  # --- Décision indemnisation ---

  Scenario: Acceptation d'une proposition d'indemnisation
    Given le sinistre est en statut APPROVED avec approvedAmount = 1500€
    When l'assuré clique sur "Accepter la proposition"
    Then le sinistre passe à CLOSED
    And closureReason = "Proposition acceptée par l'assuré"
    And un audit log STATUS_CHANGED est créé

  Scenario: Refus d'une proposition avec motif valide
    Given le sinistre est en statut APPROVED avec approvedAmount = 1500€
    When l'assuré clique "Refuser" et saisit un motif de 25 caractères
    Then le sinistre passe à CLOSED
    And closureReason contient le motif saisi

  Scenario: Refus refusé si motif trop court
    Given l'assuré saisit un motif de 10 caractères
    Then le bouton "Confirmer le refus" reste désactivé
    And un message d'erreur s'affiche

  Scenario: Décision impossible si statut != APPROVED
    Given le sinistre est en statut UNDER_REVIEW
    When l'API reçoit une décision ACCEPT
    Then elle retourne 400 "Aucune décision disponible pour ce sinistre"
```

---

## 5. Cas limites & Edge Cases

| Cas | Comportement attendu |
|-----|---------------------|
| Assuré sans `policyholderID` en session JWT | GET /api/portail/claims → 404 |
| Sinistre `APPROVED` sans `approvedAmount` | `canDecide = false`, section décision masquée |
| Double soumission d'une décision (sinistre déjà CLOSED) | 400 "Aucune décision disponible" |
| Upload concurrent de deux fichiers | Deux entrées Document distinctes en base, pas de conflit |
| Fichier avec nom contenant des caractères spéciaux | Nom conservé en base, chemin sanitisé avec `Date.now()` préfixe |
| Session expirée (4h) | Redirection automatique vers /portail/login |
| POLICYHOLDER tente d'accéder à `/api/claims` | Middleware → redirect /portail/mes-sinistres |
| Deux assurés avec le même email | Impossible (email unique sur Policyholder en DB) |
| Policyholder sans User lié (première connexion) | User POLICYHOLDER créé automatiquement en base |

---

## 6. Flux métier

### Connexion assuré
1. L'assuré navigue vers `/portail/login`
2. Il saisit son numéro de police + email (ou clique sur un compte démo)
3. NextAuth appelle le provider `policyholder`
4. Prisma vérifie la paire `(policyNumber, email)` dans la table `Policyholder`
5. Si trouvé : le User POLICYHOLDER est récupéré ou créé (liaison `Policyholder.userId`)
6. Le JWT est signé avec `role: POLICYHOLDER`, `policyholderID`, expiration 4h
7. Redirection vers `/portail/mes-sinistres`

### Consultation et upload
1. L'assuré voit la liste de ses sinistres (filtrée par `policyholderID`)
2. Il clique sur un sinistre → page détail
3. Si `canUpload = true` → section upload visible
4. Il choisit un fichier → POST `/api/portail/claims/[id]/documents`
5. Le fichier est écrit dans `uploads/[claimId]/[timestamp]-[filename]`
6. Un `Document` est créé en base + audit log

### Décision indemnisation
1. Si `canDecide = true` (APPROVED + approvedAmount) → section décision visible
2. L'assuré choisit Accepter ou Refuser
3. Si Refuser → formulaire motif (min 20 chars)
4. POST `/api/portail/claims/[id]/decision` → mise à jour `status = CLOSED`, `closureReason`
5. Audit log `STATUS_CHANGED` créé

---

## 7. Impacts sur le modèle de données

### Modèles modifiés

**`User`** — inchangé structurellement, nouveau rôle `POLICYHOLDER` dans l'enum

**`Policyholder`**
```prisma
userId  String?  @unique   // ← NOUVEAU : lien vers User POLICYHOLDER
user    User?    @relation("UserPolicyholder", fields: [userId], references: [id])
```

**`Claim`**
```prisma
closureReason  String?   // ← NOUVEAU : motif de clôture (accept/refus assuré)
```

### Nouveaux modèles

**`EmailNotification`**
```prisma
model EmailNotification {
  id        String    @id @default(cuid())
  claimId   String
  claim     Claim     @relation(fields: [claimId], references: [id], onDelete: Cascade)
  to        String
  subject   String
  body      String
  sentAt    DateTime?
  error     String?
  createdAt DateTime  @default(now())
}
```

### Nouvelles actions d'audit
- `DOCUMENT_UPLOADED_BY_POLICYHOLDER`
- `CLAIM_ACCEPTED` *(nomenclature future)*
- `CLAIM_REJECTED_BY_POLICYHOLDER` *(nomenclature future)*

### Migration
`20260308053124_add_policyholder_portal` — appliquée ✅

---

## 8. JSON structuré

```json
{
  "feature": "portail-assure-self-service",
  "version": "1.0",
  "status": "implemented",
  "personas": ["POLICYHOLDER"],
  "businessRules": [
    "Auth policyNumber+email, sans mot de passe",
    "Session JWT 4h pour POLICYHOLDER",
    "Isolation stricte : l'assuré ne voit que ses sinistres",
    "Score de fraude masqué côté portail",
    "Upload limité aux statuts SUBMITTED / UNDER_REVIEW / INFO_REQUESTED",
    "Décision uniquement si APPROVED + approvedAmount != null",
    "Motif de refus >= 20 caractères",
    "Décision ferme le sinistre (CLOSED) dans tous les cas",
    "Formats acceptés : PDF, JPG, PNG — max 5 Mo",
    "Audit trail complet sur upload et décision",
    "User POLICYHOLDER auto-créé à la première connexion"
  ],
  "acceptanceCriteria": [
    "Connexion avec policyNumber+email valides → session 4h",
    "Connexion avec identifiants invalides → erreur générique",
    "Liste sinistres → uniquement les sinistres de l'assuré",
    "Détail sinistre → pas de score fraude affiché",
    "Upload PDF/JPG/PNG <= 5Mo sur statuts éligibles → OK",
    "Upload sur sinistre CLOSED → 400",
    "Upload > 5Mo → 400",
    "Accept APPROVED+approvedAmount → CLOSED + closureReason",
    "Reject motif court → 400",
    "Reject motif long → CLOSED + closureReason avec motif"
  ],
  "apiRoutes": [
    "GET /api/portail/claims",
    "GET /api/portail/claims/[id]",
    "POST /api/portail/claims/[id]/documents",
    "POST /api/portail/claims/[id]/decision"
  ],
  "pages": [
    "/portail/login",
    "/portail/mes-sinistres",
    "/portail/mes-sinistres/[id]"
  ],
  "dataImpacts": {
    "modifiedModels": ["Policyholder", "Claim", "User (enum role)"],
    "newModels": ["EmailNotification"],
    "newFields": [
      "Policyholder.userId",
      "Claim.closureReason"
    ],
    "migrations": ["20260308053124_add_policyholder_portal"]
  },
  "tests": {
    "files": [
      "tests/api/portail/claims.test.ts",
      "tests/api/portail/claims-id.test.ts",
      "tests/api/portail/decision.test.ts"
    ],
    "total": 30,
    "passing": 30
  }
}
```

---

## 9. Résumé pour les parties prenantes

Le portail assuré permet à chaque client d'accéder en autonomie à son espace personnel sans passer par un gestionnaire. L'authentification repose sur le numéro de police et l'email — deux informations présentes sur tout contrat d'assurance — sans création de compte ni mot de passe.

Une fois connecté, l'assuré consulte l'historique et le statut de ses sinistres en temps réel. Si des documents supplémentaires sont demandés, il peut les déposer directement depuis son smartphone ou ordinateur, au format PDF, JPG ou PNG. Lorsqu'une proposition d'indemnisation est faite, il peut l'accepter ou la refuser avec un motif — ce qui clôt le dossier immédiatement.

La sécurité est garantie par un isolement strict (chaque assuré ne voit que ses dossiers), une session courte de 4 heures, et un audit complet de toutes les actions.
