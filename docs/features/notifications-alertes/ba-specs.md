# BA Specifications — Notifications & Alertes

**Feature :** `notifications-alertes`
**Version :** 1.0
**Date :** Mars 2026
**Statut :** Prêt pour développement
**Priorité :** P1
**Agent :** Business Analyst (BA)

---

## Table des matières

1. [Contexte & Valeur métier](#1-contexte--valeur-métier)
2. [Personas & Rôles concernés](#2-personas--rôles-concernés)
3. [Règles métier (NR-XX)](#3-règles-métier-nr-xx)
4. [Flux métier détaillés](#4-flux-métier-détaillés)
5. [Critères d'acceptation (Gherkin)](#5-critères-dacceptation-gherkin)
6. [Edge Cases & Comportements limites](#6-edge-cases--comportements-limites)
7. [Impacts données (Prisma)](#7-impacts-données-prisma)
8. [Impacts API](#8-impacts-api)
9. [Préférences de notification](#9-préférences-de-notification)
10. [Service email (Nodemailer)](#10-service-email-nodemailer)
11. [Cron Job SLA 30j](#11-cron-job-sla-30j)
12. [Badge in-app Navbar](#12-badge-in-app-navbar)
13. [JSON structuré — Handoff Architecte](#13-json-structuré--handoff-architecte)

---

## 1. Contexte & Valeur métier

### 1.1 Problème à résoudre

ClaimFlow AI dispose d'un mécanisme rudimentaire de notifications : la table `EmailNotification` est liée uniquement aux sinistres et gère exclusivement les emails transactionnels côté assuré (POLICYHOLDER). Les agents internes (HANDLER, MANAGER, ADMIN) ne reçoivent aucune notification proactive. Conséquences :

- Les gestionnaires découvrent les assignations en se connectant manuellement
- Aucune alerte sur les sinistres à risque élevé de fraude
- Les dépassements de SLA 30 jours ne sont pas détectés automatiquement
- Aucun indicateur visuel de charge de travail dans l'interface

### 1.2 Valeur attendue

| Métrique | Avant | Cible |
|----------|-------|-------|
| Délai moyen de prise en charge après assignation | > 4h | < 30 min |
| Sinistres détectés > 30j sans action | 0 % (détection manuelle) | 100 % automatique |
| Alertes fraude élevée manquées | ~15 % | 0 % |
| Satisfaction gestionnaires (NPS interne) | 34 | > 60 |

### 1.3 Périmètre de la feature

Cette feature couvre :
- La table `Notification` (notifications in-app pour agents internes)
- La table `NotificationPreference` (opt-in/out par type, par canal)
- L'API REST `GET /api/notifications` et `PATCH /api/notifications/:id`
- Le service d'envoi email (Nodemailer) pour les agents internes
- Le Cron Job de surveillance SLA (30 jours sans changement de statut)
- Le badge in-app non-lus dans la Navbar
- Les déclencheurs automatiques : assignation, changement de statut, fraude élevée, SLA, upload document par assuré

**Hors périmètre :** notifications push mobile, SMS, Slack/Teams, refonte du système `EmailNotification` existant pour les POLICYHOLDER (table préservée telle quelle).

---

## 2. Personas & Rôles concernés

| Persona | Rôle Prisma | Reçoit des notifications ? | Canal(ux) |
|---------|-------------|---------------------------|-----------|
| Gestionnaire | `HANDLER` | Oui | In-app + Email (opt-in) |
| Responsable | `MANAGER` | Oui — priorité haute | In-app + Email (toujours) |
| Administrateur | `ADMIN` | Oui — périmètre global | In-app + Email (opt-in) |
| Assuré | `POLICYHOLDER` | Non — système existant `EmailNotification` | Email (hors scope) |

---

## 3. Règles métier (NR-XX)

### 3.1 Règles de déclenchement

| # | Règle | Priorité | Rôles destinataires |
|---|-------|----------|---------------------|
| NR-01 | Lors de l'assignation d'un sinistre à un gestionnaire, une notification `CLAIM_ASSIGNED` est créée pour ce gestionnaire | MUST | HANDLER assigné |
| NR-02 | Lors de tout changement de statut d'un sinistre, une notification `STATUS_CHANGED` est créée pour le gestionnaire assigné (si existant) et pour tous les MANAGER | MUST | HANDLER assigné + tous MANAGER |
| NR-03 | Lorsque le `fraudScore` d'un sinistre passe au-dessus de 70, une notification `FRAUD_ALERT` est créée pour tous les MANAGER et tous les ADMIN | MUST | Tous MANAGER + Tous ADMIN |
| NR-04 | Une notification `FRAUD_ALERT` n'est déclenchée qu'une seule fois par sinistre tant que le score reste > 70 (pas de re-déclenchement à chaque analyse) | MUST | — |
| NR-05 | Lorsqu'un assuré upload un document, une notification `DOCUMENT_UPLOADED_BY_POLICYHOLDER` est créée pour le gestionnaire assigné (si existant) | MUST | HANDLER assigné |
| NR-06 | Le cron job détecte tous les sinistres actifs (statuts `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED`) dont la dernière mise à jour (`updatedAt`) dépasse 30 jours calendaires | MUST | — |
| NR-07 | Pour chaque sinistre en dépassement SLA, une notification `SLA_BREACH` est créée pour le gestionnaire assigné ET pour tous les MANAGER | MUST | HANDLER assigné + tous MANAGER |
| NR-08 | Une notification `SLA_BREACH` pour un sinistre donné n'est recréée qu'une fois par tranche de 7 jours supplémentaires de dépassement (éviter le spam) | MUST | — |
| NR-09 | Si un sinistre n'a pas de gestionnaire assigné, les notifications destinées au HANDLER sont envoyées à tous les MANAGER à la place | SHOULD | Tous MANAGER (fallback) |

### 3.2 Règles d'état des notifications

| # | Règle | Priorité |
|---|-------|----------|
| NR-10 | Toute notification créée a le statut `UNREAD` par défaut | MUST |
| NR-11 | Une notification passe à `READ` uniquement via l'action explicite de l'utilisateur destinataire (API PATCH) | MUST |
| NR-12 | Le marquage "tout lire" (`PATCH /api/notifications?markAllRead=true`) est autorisé | MUST |
| NR-13 | Une notification ne peut être supprimée physiquement que par un ADMIN | SHOULD |
| NR-14 | Une notification est conservée 90 jours en base puis archivée (soft delete via `archivedAt`) | SHOULD |
| NR-15 | Un utilisateur ne peut lire/modifier que ses propres notifications (isolation par `userId`) | MUST |

### 3.3 Règles d'envoi email

| # | Règle | Priorité |
|---|-------|----------|
| NR-16 | L'envoi email est conditionné par la préférence `NotificationPreference.emailEnabled = true` pour le type concerné | MUST |
| NR-17 | Les MANAGER reçoivent les emails `FRAUD_ALERT` et `SLA_BREACH` par défaut (`emailEnabled = true` à la création du compte) | MUST |
| NR-18 | Les HANDLER ont tous les emails désactivés par défaut et peuvent les activer via leurs préférences | SHOULD |
| NR-19 | Les ADMIN ont les emails `FRAUD_ALERT` activés par défaut uniquement | SHOULD |
| NR-20 | En cas d'échec d'envoi email, l'erreur est loguée dans `Notification.emailError` et la notification in-app reste créée | MUST |
| NR-21 | Les emails sont envoyés de manière asynchrone (ne bloquent pas la réponse API) | MUST |
| NR-22 | Le sujet de l'email inclut le numéro de sinistre (`CLM-YYYY-NNNNN`) si applicable | MUST |

### 3.4 Règles de préférences

| # | Règle | Priorité |
|---|-------|----------|
| NR-23 | Chaque utilisateur dispose d'un enregistrement `NotificationPreference` par type de notification | MUST |
| NR-24 | Les préférences sont créées automatiquement avec les valeurs par défaut lors de la création du compte utilisateur | MUST |
| NR-25 | Un utilisateur peut mettre à jour ses propres préférences via `PATCH /api/notifications/preferences` | MUST |
| NR-26 | Un ADMIN peut mettre à jour les préférences d'un autre utilisateur | SHOULD |
| NR-27 | La désactivation `inAppEnabled = false` pour un type supprime la création de la notification in-app mais n'empêche pas l'email si `emailEnabled = true` | MUST |

### 3.5 Règles de sécurité & audit

| # | Règle | Priorité |
|---|-------|----------|
| NR-28 | Toutes les routes `/api/notifications/*` requièrent une session valide (JWT) | MUST |
| NR-29 | Les POLICYHOLDER sont explicitement interdits d'accès aux routes `/api/notifications/*` (HTTP 403) | MUST |
| NR-30 | Le marquage lu d'une notification est tracé dans `AuditLog` (action `NOTIFICATION_READ`) | SHOULD |
| NR-31 | La création d'une notification `FRAUD_ALERT` est toujours tracée dans `AuditLog` (action `FRAUD_ALERT_SENT`) | MUST |

---

## 4. Flux métier détaillés

### 4.1 Flux : Assignation d'un sinistre

```
HANDLER/MANAGER/ADMIN
        │
        ▼
PATCH /api/claims/:id  (body: { assignedToID: "handler-id" })
        │
        ▼
claim-service.ts : updateClaim()
        │
        ├─ Mise à jour Claim.assignedToID en base
        │
        ├─ AuditLog (action: CLAIM_UPDATED)
        │
        └─ notification-service.ts : triggerNotification(CLAIM_ASSIGNED)
                │
                ├─ Créer Notification { userId: handler-id, type: CLAIM_ASSIGNED, ... }
                │
                └─ Si NotificationPreference.emailEnabled = true
                        └─ emailService.sendAsync({ template: "claim-assigned", ... })
```

### 4.2 Flux : Changement de statut

```
Acteur (MANAGER/ADMIN)
        │
        ▼
PATCH /api/claims/:id  (body: { status: "APPROVED" })
        │
        ▼
claim-service.ts : updateClaimStatus()
        │
        ├─ Mise à jour Claim.status
        ├─ AuditLog (action: STATUS_CHANGED)
        │
        └─ notification-service.ts : triggerNotification(STATUS_CHANGED)
                │
                ├─ Récupérer : gestionnaire assigné + tous les MANAGER
                │
                ├─ Pour chaque destinataire :
                │       ├─ Créer Notification { type: STATUS_CHANGED, ... }
                │       └─ Si emailEnabled → sendAsync()
                │
                └─ [Si statut = APPROVED et auto-approval]
                        └─ Même déclenchement (pas d'exception)
```

### 4.3 Flux : Fraude élevée détectée

```
POST /api/claims/:id/analyze  (analyse IA)
        │
        ▼
ai-service.ts : runFraudScoring()
        │
        ▼
Résultat : fraudScore = 78, fraudRisk = "HIGH"
        │
        ├─ Mise à jour Claim.fraudScore + Claim.fraudRisk
        │
        └─ notification-service.ts : triggerFraudAlert(claimId, fraudScore)
                │
                ├─ Vérifier : existe-t-il déjà une Notification FRAUD_ALERT non-archivée pour ce sinistre ?
                │       └─ Si oui → STOP (NR-04)
                │       └─ Si non → continuer
                │
                ├─ Récupérer : tous MANAGER + tous ADMIN
                │
                ├─ Pour chaque destinataire :
                │       ├─ Créer Notification { type: FRAUD_ALERT, priority: HIGH, ... }
                │       └─ emailEnabled → sendAsync() (activé par défaut pour MANAGER)
                │
                └─ AuditLog (action: FRAUD_ALERT_SENT)
```

### 4.4 Flux : Upload document par assuré

```
POST /api/portail/claims/:id/documents  (rôle POLICYHOLDER)
        │
        ▼
Document créé en base
        │
        ├─ AuditLog (action: DOCUMENT_UPLOADED_BY_POLICYHOLDER)
        │
        └─ notification-service.ts : triggerNotification(DOCUMENT_UPLOADED_BY_POLICYHOLDER)
                │
                ├─ Récupérer gestionnaire assigné
                │       └─ Si null → fallback vers tous les MANAGER (NR-09)
                │
                └─ Créer Notification + email conditionnel
```

### 4.5 Flux : Cron Job SLA 30 jours

```
Cron : exécution quotidienne à 08h00 UTC
        │
        ▼
sla-cron.ts : checkSLABreaches()
        │
        ├─ Requête Prisma :
        │   Claim WHERE status IN [SUBMITTED, UNDER_REVIEW, INFO_REQUESTED]
        │         AND updatedAt < now() - 30 jours
        │
        ├─ Pour chaque sinistre en dépassement :
        │   │
        │   ├─ Calculer jours de dépassement = ceil((now - updatedAt) / 86400000) - 30
        │   │
        │   ├─ Vérifier dernière Notification SLA_BREACH pour ce sinistre :
        │   │       └─ Si créée il y a < 7 jours → SKIP (NR-08)
        │   │       └─ Si absente ou > 7 jours → continuer
        │   │
        │   ├─ Récupérer : gestionnaire assigné + tous MANAGER
        │   │
        │   ├─ Pour chaque destinataire :
        │   │       ├─ Créer Notification { type: SLA_BREACH, metadata: { daysOverdue } }
        │   │       └─ emailEnabled → sendAsync()
        │   │
        │   └─ AuditLog (action: SLA_BREACH_DETECTED, claimId)
        │
        └─ Log cron : { checked: N, breached: M, notified: K }
```

### 4.6 Flux : Consultation des notifications (in-app)

```
Navbar (React) — polling ou SSE
        │
        ▼
GET /api/notifications?status=UNREAD&limit=10
        │
        ├─ Auth : vérifier JWT → userId
        ├─ Filtrer par userId + status=UNREAD
        └─ Retourner { notifications: [...], unreadCount: N }
                │
                ▼
        Badge Navbar : afficher N si N > 0
        Panel dropdown : liste des N dernières non-lues
                │
                ▼
        Clic sur notification → PATCH /api/notifications/:id { status: "READ" }
                │
                ▼
        Redirection vers /claims/:claimId si applicable
```

---

## 5. Critères d'acceptation (Gherkin)

```gherkin
Feature: Notifications & Alertes — ClaimFlow AI

  Background:
    Given la base de données contient les utilisateurs :
      | email                 | rôle    | nom          |
      | julie@claimflow.ai    | HANDLER | Julie Martin |
      | marc@claimflow.ai     | MANAGER | Marc Dupont  |
      | thomas@claimflow.ai   | ADMIN   | Thomas Noir  |
    And le sinistre "CLM-2026-00042" est assigné à Julie
    And le sinistre "CLM-2026-00042" a le statut "UNDER_REVIEW"

  # ─────────────────────────────────────────────
  # DÉCLENCHEUR : Assignation
  # ─────────────────────────────────────────────

  Scenario: Notification in-app créée lors de l'assignation d'un sinistre
    Given Marc (MANAGER) est connecté
    When il assigne le sinistre "CLM-2026-00042" à Julie via PATCH /api/claims/:id
    Then une Notification de type "CLAIM_ASSIGNED" est créée pour Julie
    And la notification a le statut "UNREAD"
    And le badge in-app de Julie affiche au moins 1

  Scenario: Email envoyé si la préférence email est activée pour CLAIM_ASSIGNED
    Given Julie a NotificationPreference { type: CLAIM_ASSIGNED, emailEnabled: true }
    When le sinistre "CLM-2026-00042" est assigné à Julie
    Then un email est envoyé à "julie@claimflow.ai"
    And le sujet contient "CLM-2026-00042"
    And "Notification.emailSentAt" est renseigné

  Scenario: Pas d'email si la préférence email est désactivée
    Given Julie a NotificationPreference { type: CLAIM_ASSIGNED, emailEnabled: false }
    When le sinistre "CLM-2026-00042" est assigné à Julie
    Then une Notification in-app est créée pour Julie
    And aucun email n'est envoyé à "julie@claimflow.ai"

  # ─────────────────────────────────────────────
  # DÉCLENCHEUR : Changement de statut
  # ─────────────────────────────────────────────

  Scenario: Notification STATUS_CHANGED pour le gestionnaire assigné et les MANAGER
    Given Marc (MANAGER) approuve le sinistre "CLM-2026-00042"
    When PATCH /api/claims/:id { status: "APPROVED" } est exécuté
    Then une Notification "STATUS_CHANGED" est créée pour Julie (HANDLER assigné)
    And une Notification "STATUS_CHANGED" est créée pour Marc (MANAGER)
    And le metadata contient { previousStatus: "UNDER_REVIEW", newStatus: "APPROVED" }

  Scenario: Notification STATUS_CHANGED si le sinistre n'a pas de gestionnaire assigné
    Given le sinistre "CLM-2026-00099" n'est assigné à aucun gestionnaire
    When son statut change vers "APPROVED"
    Then des Notifications "STATUS_CHANGED" sont créées pour tous les MANAGER
    And aucune notification n'est créée pour les HANDLER non assignés

  # ─────────────────────────────────────────────
  # DÉCLENCHEUR : Fraude élevée
  # ─────────────────────────────────────────────

  Scenario: Alerte fraude créée quand fraudScore dépasse 70
    Given l'analyse IA retourne fraudScore = 78 pour "CLM-2026-00042"
    When le résultat est sauvegardé en base
    Then des Notifications "FRAUD_ALERT" sont créées pour tous les MANAGER
    And des Notifications "FRAUD_ALERT" sont créées pour tous les ADMIN
    And une entrée AuditLog de type "FRAUD_ALERT_SENT" est créée
    And les emails FRAUD_ALERT sont envoyés aux MANAGER (preference par défaut = true)

  Scenario: Pas de doublon d'alerte fraude pour le même sinistre
    Given une Notification "FRAUD_ALERT" existe déjà pour "CLM-2026-00042"
    When une nouvelle analyse retourne fraudScore = 82
    Then aucune nouvelle Notification "FRAUD_ALERT" n'est créée
    And aucun email supplémentaire n'est envoyé

  Scenario: Pas d'alerte fraude si fraudScore passe de 80 à 65
    Given le sinistre "CLM-2026-00042" a fraudScore = 80
    When une nouvelle analyse retourne fraudScore = 65
    Then aucune Notification "FRAUD_ALERT" n'est créée
    And aucun email n'est envoyé

  # ─────────────────────────────────────────────
  # DÉCLENCHEUR : Upload document par assuré
  # ─────────────────────────────────────────────

  Scenario: Notification DOCUMENT_UPLOADED_BY_POLICYHOLDER pour le gestionnaire
    Given l'assuré Marie Dupont est connectée via le portail
    When elle uploade un fichier sur le sinistre "CLM-2026-00042"
    Then une Notification "DOCUMENT_UPLOADED_BY_POLICYHOLDER" est créée pour Julie
    And le metadata contient { documentId, filename, uploadedBy: "Marie Dupont" }

  Scenario: Fallback MANAGER si le sinistre n'a pas de gestionnaire assigné
    Given le sinistre "CLM-2026-00099" n'est assigné à aucun gestionnaire
    When l'assuré uploade un document sur ce sinistre
    Then des Notifications "DOCUMENT_UPLOADED_BY_POLICYHOLDER" sont créées pour tous les MANAGER

  # ─────────────────────────────────────────────
  # DÉCLENCHEUR : SLA 30 jours (Cron)
  # ─────────────────────────────────────────────

  Scenario: Détection SLA dépassé et création de notification
    Given le sinistre "CLM-2026-00001" a le statut "UNDER_REVIEW"
    And sa dernière mise à jour date de 31 jours
    When le cron SLA s'exécute
    Then des Notifications "SLA_BREACH" sont créées pour Julie et Marc
    And le metadata contient { daysOverdue: 1, claimNumber: "CLM-2026-00001" }
    And une entrée AuditLog "SLA_BREACH_DETECTED" est créée

  Scenario: Pas de doublon SLA dans les 7 jours suivants
    Given une Notification "SLA_BREACH" a été créée il y a 3 jours pour "CLM-2026-00001"
    When le cron s'exécute à nouveau
    Then aucune nouvelle Notification "SLA_BREACH" n'est créée pour "CLM-2026-00001"

  Scenario: Nouvelle notification SLA après 7 jours supplémentaires
    Given une Notification "SLA_BREACH" a été créée il y a 8 jours pour "CLM-2026-00001"
    And le sinistre est toujours en statut actif
    When le cron s'exécute
    Then une nouvelle Notification "SLA_BREACH" est créée
    And le metadata contient { daysOverdue: 8 }

  Scenario: Sinistre CLOSED/APPROVED exclu du contrôle SLA
    Given le sinistre "CLM-2026-00002" a le statut "CLOSED"
    And sa dernière mise à jour date de 60 jours
    When le cron SLA s'exécute
    Then aucune Notification n'est créée pour ce sinistre

  # ─────────────────────────────────────────────
  # API GET /api/notifications
  # ─────────────────────────────────────────────

  Scenario: Récupérer les notifications non-lues de l'utilisateur connecté
    Given Julie est connectée et a 3 notifications UNREAD et 2 notifications READ
    When elle appelle GET /api/notifications?status=UNREAD
    Then la réponse contient 3 notifications
    And chaque notification a userId = julie.id
    And la réponse inclut { unreadCount: 3 }

  Scenario: Un utilisateur ne voit pas les notifications des autres
    Given Julie est connectée
    When elle appelle GET /api/notifications
    Then la réponse ne contient aucune notification appartenant à Marc ou Thomas

  Scenario: Accès refusé pour les POLICYHOLDER
    Given Marie (POLICYHOLDER) est connectée
    When elle appelle GET /api/notifications
    Then la réponse est HTTP 403 avec { error: "Forbidden" }

  # ─────────────────────────────────────────────
  # API PATCH /api/notifications/:id
  # ─────────────────────────────────────────────

  Scenario: Marquer une notification comme lue
    Given Julie a une notification UNREAD avec id "notif-001"
    When elle appelle PATCH /api/notifications/notif-001 { status: "READ" }
    Then la réponse est HTTP 200
    And la notification a status = "READ" et readAt = maintenant
    And GET /api/notifications?status=UNREAD ne retourne plus "notif-001"

  Scenario: Impossible de marquer la notification d'un autre utilisateur
    Given Marc essaie de marquer "notif-001" (appartenant à Julie)
    When il appelle PATCH /api/notifications/notif-001 { status: "READ" }
    Then la réponse est HTTP 403

  Scenario: Marquer toutes les notifications comme lues
    Given Julie a 5 notifications UNREAD
    When elle appelle PATCH /api/notifications?markAllRead=true
    Then toutes ses notifications ont status = "READ"
    And le badge in-app affiche 0

  # ─────────────────────────────────────────────
  # PRÉFÉRENCES
  # ─────────────────────────────────────────────

  Scenario: Mettre à jour ses préférences de notification
    Given Julie est connectée
    When elle appelle PATCH /api/notifications/preferences
      With body: { type: "CLAIM_ASSIGNED", emailEnabled: true }
    Then NotificationPreference de Julie pour CLAIM_ASSIGNED a emailEnabled = true
    And la réponse est HTTP 200

  Scenario: Préférences créées automatiquement à la création du compte
    Given un nouveau HANDLER "sophie@claimflow.ai" est créé
    Then 5 enregistrements NotificationPreference sont créés pour Sophie
    And emailEnabled = false pour tous les types (valeur par défaut HANDLER)
    And inAppEnabled = true pour tous les types

  # ─────────────────────────────────────────────
  # BADGE IN-APP
  # ─────────────────────────────────────────────

  Scenario: Badge Navbar affiche le nombre de notifications non-lues
    Given Julie a 4 notifications UNREAD
    When la Navbar se charge
    Then le badge affiche "4"

  Scenario: Badge disparaît quand toutes les notifications sont lues
    Given Julie a 1 notification UNREAD
    When elle marque cette notification comme lue
    Then le badge disparaît (count = 0)

  Scenario: Badge limité à 99+ si plus de 99 notifications non-lues
    Given Julie a 150 notifications UNREAD
    When la Navbar se charge
    Then le badge affiche "99+"
```

---

## 6. Edge Cases & Comportements limites

### 6.1 Idempotence et déduplication

| Cas | Comportement attendu |
|-----|---------------------|
| Double exécution du cron dans la même fenêtre | La vérification "SLA_BREACH créée < 7j" protège contre les doublons |
| Analyse IA lancée 3 fois sur le même sinistre frauduleux | `FRAUD_ALERT` créée une seule fois (vérification en base avant insertion) |
| Assignation du même gestionnaire deux fois de suite | La seconde assignation crée une nouvelle notification (comportement voulu : rappel) |
| Changement de statut vers le même statut (bug API) | Vérification `previousStatus !== newStatus` avant déclenchement |

### 6.2 Données manquantes / états incohérents

| Cas | Comportement attendu |
|-----|---------------------|
| Destinataire supprimé (compte désactivé `active = false`) | Notification non créée, email non envoyé ; log warning |
| Aucun MANAGER en base | Notifications FRAUD_ALERT/SLA non créées, erreur loguée en critical |
| Email non configuré (SMTP absent) | Notification in-app créée, email ignoré silencieusement, `emailError` = "SMTP_NOT_CONFIGURED" |
| `claimId` invalide dans le service de notification | Levée d'exception `NotificationError`, pas de création partielle |
| Notification pour un utilisateur POLICYHOLDER via le service interne | Rejet silencieux (guard dans notification-service) |

### 6.3 Performance & volumétrie

| Cas | Contrainte |
|-----|-----------|
| Cron sur 500 sinistres en dépassement | Traitement par batch de 50 sinistres (pas de transaction unique géante) |
| GET /api/notifications avec utilisateur ayant 10 000 notifications | Pagination obligatoire : `limit` max = 50, `cursor`-based pagination |
| Badge polling fréquent | Endpoint `GET /api/notifications/count` dédié (réponse < 50ms) |
| Email burst (ex: 30 MANAGER lors d'une alerte fraude) | File d'attente asynchrone (Promise.allSettled) — pas de await séquentiel |

### 6.4 Sécurité

| Cas | Protection |
|-----|-----------|
| Injection dans le contenu de la notification | Sanitisation via `zod.string().max(500)` sur tous les champs libres |
| Enumération des IDs de notification | IDs en CUID (non prédictibles) + vérification ownership |
| Accès aux notifications d'un autre utilisateur | Double vérification : JWT userId + `Notification.userId` en base |
| POLICYHOLDER tentant d'accéder aux routes notifications | Middleware de rôle explicite (403 avant exécution de la logique) |

---

## 7. Impacts données (Prisma)

### 7.1 Nouveau modèle `Notification`

```prisma
model Notification {
  id          String    @id @default(cuid())
  type        String    // CLAIM_ASSIGNED | STATUS_CHANGED | FRAUD_ALERT | SLA_BREACH | DOCUMENT_UPLOADED_BY_POLICYHOLDER
  status      String    @default("UNREAD") // UNREAD | READ
  priority    String    @default("NORMAL") // LOW | NORMAL | HIGH | CRITICAL
  title       String
  message     String
  metadata    String?   // JSON string : { claimId, claimNumber, previousStatus, newStatus, fraudScore, daysOverdue, ... }
  readAt      DateTime?
  archivedAt  DateTime?

  // Cible
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Sinistre lié (optionnel)
  claimId     String?
  claim       Claim?    @relation(fields: [claimId], references: [id], onDelete: SetNull)

  // Email
  emailSent     Boolean   @default(false)
  emailSentAt   DateTime?
  emailError    String?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId, status])
  @@index([claimId])
  @@index([type, claimId])
  @@index([createdAt])
}
```

### 7.2 Nouveau modèle `NotificationPreference`

```prisma
model NotificationPreference {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type          String   // CLAIM_ASSIGNED | STATUS_CHANGED | FRAUD_ALERT | SLA_BREACH | DOCUMENT_UPLOADED_BY_POLICYHOLDER
  inAppEnabled  Boolean  @default(true)
  emailEnabled  Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, type])
  @@index([userId])
}
```

### 7.3 Valeurs par défaut des préférences par rôle

| Type | HANDLER inApp | HANDLER email | MANAGER inApp | MANAGER email | ADMIN inApp | ADMIN email |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| CLAIM_ASSIGNED | true | false | true | false | true | false |
| STATUS_CHANGED | true | false | true | false | true | false |
| FRAUD_ALERT | true | false | true | **true** | true | **true** |
| SLA_BREACH | true | false | true | **true** | true | false |
| DOCUMENT_UPLOADED_BY_POLICYHOLDER | true | false | true | false | false | false |

### 7.4 Modifications des modèles existants

**Modèle `User`** — ajout des relations :
```prisma
notifications            Notification[]
notificationPreferences  NotificationPreference[]
```

**Modèle `Claim`** — ajout de la relation :
```prisma
notifications  Notification[]
```

**Modèle `AuditLog`** — nouveaux types d'actions à documenter :
- `NOTIFICATION_READ`
- `FRAUD_ALERT_SENT`
- `SLA_BREACH_DETECTED`

### 7.5 Migration nécessaire

Une nouvelle migration Prisma est requise :
```
npx prisma migrate dev --name add-notifications
```

Aucune donnée existante n'est modifiée. La table `EmailNotification` reste intacte.

---

## 8. Impacts API

### 8.1 Nouvelles routes

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/notifications` | JWT (HANDLER/MANAGER/ADMIN) | Lister les notifications de l'utilisateur connecté |
| GET | `/api/notifications/count` | JWT (HANDLER/MANAGER/ADMIN) | Comptage non-lus (badge) |
| PATCH | `/api/notifications/:id` | JWT (propriétaire) | Marquer lue / archiver |
| PATCH | `/api/notifications` | JWT (HANDLER/MANAGER/ADMIN) | Marquer tout comme lu |
| GET | `/api/notifications/preferences` | JWT (HANDLER/MANAGER/ADMIN) | Lire les préférences |
| PATCH | `/api/notifications/preferences` | JWT (HANDLER/MANAGER/ADMIN) | Mettre à jour les préférences |

### 8.2 Routes existantes impactées (ajout du déclenchement)

| Route | Déclencheur ajouté |
|-------|-------------------|
| `PATCH /api/claims/:id` | `CLAIM_ASSIGNED` (si `assignedToID` change) / `STATUS_CHANGED` (si `status` change) |
| `POST /api/claims/:id/analyze` | `FRAUD_ALERT` (si `fraudScore` > 70) |
| `POST /api/portail/claims/:id/documents` | `DOCUMENT_UPLOADED_BY_POLICYHOLDER` |

### 8.3 Contrats API (schemas Zod)

**GET /api/notifications**
```typescript
// Query params
const GetNotificationsQuery = z.object({
  status: z.enum(["UNREAD", "READ"]).optional(),
  type: z.enum(["CLAIM_ASSIGNED", "STATUS_CHANGED", "FRAUD_ALERT", "SLA_BREACH", "DOCUMENT_UPLOADED_BY_POLICYHOLDER"]).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().optional(), // CUID du dernier élément (pagination cursor-based)
})

// Response
type GetNotificationsResponse = {
  notifications: Notification[]
  unreadCount: number
  nextCursor: string | null
}
```

**PATCH /api/notifications/:id**
```typescript
const UpdateNotificationBody = z.object({
  status: z.enum(["READ"]),
})
```

**PATCH /api/notifications** (bulk)
```typescript
// Query param: ?markAllRead=true
```

**PATCH /api/notifications/preferences**
```typescript
const UpdatePreferenceBody = z.object({
  type: z.enum(["CLAIM_ASSIGNED", "STATUS_CHANGED", "FRAUD_ALERT", "SLA_BREACH", "DOCUMENT_UPLOADED_BY_POLICYHOLDER"]),
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
})
```

---

## 9. Préférences de notification

### 9.1 Interface utilisateur

La gestion des préférences est accessible via :
- `/dashboard/settings` (ou page dédiée `/notifications/preferences`)
- Section "Mes notifications" dans le profil utilisateur

### 9.2 Interface de configuration

```
┌─────────────────────────────────────────────────────┐
│  Mes préférences de notification                    │
├──────────────────────────────┬──────────┬───────────┤
│  Type                        │ In-app   │  Email    │
├──────────────────────────────┼──────────┼───────────┤
│  Assignation sinistre        │  [✓]     │  [ ]      │
│  Changement de statut        │  [✓]     │  [ ]      │
│  Alerte fraude élevée        │  [✓]     │  [✓]      │
│  Dépassement SLA 30j         │  [✓]     │  [ ]      │
│  Document uploadé (assuré)   │  [✓]     │  [ ]      │
└──────────────────────────────┴──────────┴───────────┘
```

---

## 10. Service email (Nodemailer)

### 10.1 Templates email requis

| Type | Sujet | Variables |
|------|-------|-----------|
| `CLAIM_ASSIGNED` | `[ClaimFlow] Sinistre {claimNumber} vous a été assigné` | claimNumber, claimType, incidentDate, policyholderName |
| `STATUS_CHANGED` | `[ClaimFlow] Statut du sinistre {claimNumber} mis à jour : {newStatus}` | claimNumber, previousStatus, newStatus, updatedBy |
| `FRAUD_ALERT` | `[ClaimFlow] ALERTE FRAUDE — Sinistre {claimNumber} (score : {fraudScore})` | claimNumber, fraudScore, fraudRisk, claimType |
| `SLA_BREACH` | `[ClaimFlow] SLA dépassé — Sinistre {claimNumber} en attente depuis {daysOverdue}j` | claimNumber, daysOverdue, currentStatus, assignedTo |
| `DOCUMENT_UPLOADED_BY_POLICYHOLDER` | `[ClaimFlow] Nouveau document sur le sinistre {claimNumber}` | claimNumber, filename, uploadedBy, uploadedAt |

### 10.2 Configuration Nodemailer

Variables d'environnement requises :
```
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="notifications@claimflow.ai"
SMTP_PASS="..."
SMTP_FROM="ClaimFlow AI <notifications@claimflow.ai>"
```

Si `SMTP_HOST` est absent, le service email est désactivé silencieusement (mode "log only").

### 10.3 Gestion des erreurs email

- Timeout SMTP : 10 secondes
- Retry : aucun retry automatique (log + `emailError` en base)
- En cas d'erreur partielle (certains destinataires OK, d'autres KO) : chaque notification enregistre son propre statut

---

## 11. Cron Job SLA 30j

### 11.1 Spécifications

| Attribut | Valeur |
|----------|--------|
| Fréquence | Quotidienne à 08h00 UTC |
| Mécanisme | `node-cron` ou endpoint `/api/cron/sla-check` protégé par `CRON_SECRET` |
| Déclenchement manuel | `POST /api/cron/sla-check` avec header `Authorization: Bearer {CRON_SECRET}` |
| Timeout max | 120 secondes |
| Stratégie batch | 50 sinistres par lot |

### 11.2 Variables d'environnement

```
CRON_SECRET="claimflow-cron-secret-..."
SLA_THRESHOLD_DAYS=30       # Seuil SLA (configurable)
SLA_REMINDER_INTERVAL_DAYS=7  # Intervalle entre rappels (configurable)
```

### 11.3 Logging

Le cron produit un log structuré JSON à chaque exécution :
```json
{
  "timestamp": "2026-03-08T08:00:01.234Z",
  "job": "sla-breach-check",
  "claimsChecked": 247,
  "breachesDetected": 12,
  "notificationsCreated": 31,
  "emailsSent": 18,
  "errors": [],
  "durationMs": 4231
}
```

---

## 12. Badge in-app Navbar

### 12.1 Comportement

- Le badge est un composant React `<NotificationBadge />` intégré dans `<Navbar />`
- Il interroge `GET /api/notifications/count` au montage du composant
- Polling toutes les 60 secondes (pas de WebSocket pour la v1)
- Le badge ne s'affiche pas pour les POLICYHOLDER (ils ont leur système séparé)
- Clic sur le badge ouvre un dropdown listant les 10 dernières notifications non-lues
- Clic sur une notification dans le dropdown : marque comme lue + navigue vers `/claims/:claimId`

### 12.2 États visuels

| Count | Affichage | Style |
|-------|-----------|-------|
| 0 | Badge masqué | — |
| 1–9 | Chiffre | Rouge, coin supérieur droit de l'icône cloche |
| 10–99 | Chiffre | Rouge |
| 100+ | "99+" | Rouge |

### 12.3 Icônes par type de notification (dropdown)

| Type | Icône | Couleur |
|------|-------|---------|
| CLAIM_ASSIGNED | UserCheck | Bleu |
| STATUS_CHANGED | RefreshCw | Vert |
| FRAUD_ALERT | AlertTriangle | Rouge |
| SLA_BREACH | Clock | Orange |
| DOCUMENT_UPLOADED_BY_POLICYHOLDER | FileText | Violet |

---

## 13. JSON structuré — Handoff Architecte

```json
{
  "feature": "notifications-alertes",
  "version": "1.0",
  "date": "2026-03-08",
  "priority": "P1",
  "status": "ready_for_architect",

  "newModels": [
    {
      "name": "Notification",
      "fields": [
        { "name": "id", "type": "String", "default": "cuid()", "primaryKey": true },
        { "name": "type", "type": "String", "enum": ["CLAIM_ASSIGNED", "STATUS_CHANGED", "FRAUD_ALERT", "SLA_BREACH", "DOCUMENT_UPLOADED_BY_POLICYHOLDER"] },
        { "name": "status", "type": "String", "default": "UNREAD", "enum": ["UNREAD", "READ"] },
        { "name": "priority", "type": "String", "default": "NORMAL", "enum": ["LOW", "NORMAL", "HIGH", "CRITICAL"] },
        { "name": "title", "type": "String" },
        { "name": "message", "type": "String" },
        { "name": "metadata", "type": "String?", "format": "JSON" },
        { "name": "readAt", "type": "DateTime?" },
        { "name": "archivedAt", "type": "DateTime?" },
        { "name": "userId", "type": "String", "relation": "User" },
        { "name": "claimId", "type": "String?", "relation": "Claim", "onDelete": "SetNull" },
        { "name": "emailSent", "type": "Boolean", "default": false },
        { "name": "emailSentAt", "type": "DateTime?" },
        { "name": "emailError", "type": "String?" },
        { "name": "createdAt", "type": "DateTime", "default": "now()" },
        { "name": "updatedAt", "type": "DateTime", "updatedAt": true }
      ],
      "indexes": [
        ["userId", "status"],
        ["claimId"],
        ["type", "claimId"],
        ["createdAt"]
      ]
    },
    {
      "name": "NotificationPreference",
      "fields": [
        { "name": "id", "type": "String", "default": "cuid()", "primaryKey": true },
        { "name": "userId", "type": "String", "relation": "User" },
        { "name": "type", "type": "String", "enum": ["CLAIM_ASSIGNED", "STATUS_CHANGED", "FRAUD_ALERT", "SLA_BREACH", "DOCUMENT_UPLOADED_BY_POLICYHOLDER"] },
        { "name": "inAppEnabled", "type": "Boolean", "default": true },
        { "name": "emailEnabled", "type": "Boolean", "default": false },
        { "name": "createdAt", "type": "DateTime", "default": "now()" },
        { "name": "updatedAt", "type": "DateTime", "updatedAt": true }
      ],
      "uniqueConstraints": [["userId", "type"]],
      "indexes": [["userId"]]
    }
  ],

  "modifiedModels": [
    {
      "name": "User",
      "addRelations": ["notifications", "notificationPreferences"]
    },
    {
      "name": "Claim",
      "addRelations": ["notifications"]
    },
    {
      "name": "AuditLog",
      "addActionTypes": ["NOTIFICATION_READ", "FRAUD_ALERT_SENT", "SLA_BREACH_DETECTED"]
    }
  ],

  "newRoutes": [
    {
      "method": "GET",
      "path": "/api/notifications",
      "auth": ["HANDLER", "MANAGER", "ADMIN"],
      "queryParams": ["status", "type", "limit", "cursor"],
      "response": "{ notifications: Notification[], unreadCount: number, nextCursor: string | null }"
    },
    {
      "method": "GET",
      "path": "/api/notifications/count",
      "auth": ["HANDLER", "MANAGER", "ADMIN"],
      "response": "{ unreadCount: number }"
    },
    {
      "method": "PATCH",
      "path": "/api/notifications/:id",
      "auth": ["HANDLER", "MANAGER", "ADMIN"],
      "body": "{ status: 'READ' }",
      "ownership": "userId must match session.user.id"
    },
    {
      "method": "PATCH",
      "path": "/api/notifications",
      "auth": ["HANDLER", "MANAGER", "ADMIN"],
      "queryParams": ["markAllRead"],
      "description": "Bulk mark all as read"
    },
    {
      "method": "GET",
      "path": "/api/notifications/preferences",
      "auth": ["HANDLER", "MANAGER", "ADMIN"],
      "response": "NotificationPreference[]"
    },
    {
      "method": "PATCH",
      "path": "/api/notifications/preferences",
      "auth": ["HANDLER", "MANAGER", "ADMIN"],
      "body": "{ type: NotificationType, inAppEnabled?: boolean, emailEnabled?: boolean }"
    },
    {
      "method": "POST",
      "path": "/api/cron/sla-check",
      "auth": "CRON_SECRET header",
      "description": "Déclenché par scheduler ou appel manuel protégé"
    }
  ],

  "modifiedRoutes": [
    {
      "path": "/api/claims/:id",
      "method": "PATCH",
      "addTriggers": ["CLAIM_ASSIGNED (si assignedToID change)", "STATUS_CHANGED (si status change)"]
    },
    {
      "path": "/api/claims/:id/analyze",
      "method": "POST",
      "addTriggers": ["FRAUD_ALERT (si fraudScore > 70)"]
    },
    {
      "path": "/api/portail/claims/:id/documents",
      "method": "POST",
      "addTriggers": ["DOCUMENT_UPLOADED_BY_POLICYHOLDER"]
    }
  ],

  "newServices": [
    {
      "file": "src/lib/notification-service.ts",
      "exports": [
        "triggerNotification(type, claimId, recipientIds)",
        "triggerFraudAlert(claimId, fraudScore)",
        "triggerSLABreach(claimId, daysOverdue)",
        "createDefaultPreferences(userId, role)"
      ]
    },
    {
      "file": "src/lib/email-service.ts",
      "exports": [
        "sendNotificationEmail(notification, user)",
        "sendAsync(params)"
      ],
      "dependencies": ["nodemailer"]
    },
    {
      "file": "src/lib/sla-cron.ts",
      "exports": ["checkSLABreaches()"],
      "trigger": "POST /api/cron/sla-check"
    }
  ],

  "newComponents": [
    {
      "file": "src/components/NotificationBadge.tsx",
      "props": "{}",
      "polling": "60s → GET /api/notifications/count"
    },
    {
      "file": "src/components/NotificationDropdown.tsx",
      "props": "{ notifications: Notification[] }",
      "actions": ["mark as read", "navigate to claim"]
    }
  ],

  "newDependencies": [
    { "package": "nodemailer", "version": "^6.9.x", "type": "production" },
    { "package": "@types/nodemailer", "version": "^6.4.x", "type": "dev" },
    { "package": "node-cron", "version": "^3.0.x", "type": "production" },
    { "package": "@types/node-cron", "version": "^3.0.x", "type": "dev" }
  ],

  "newEnvVars": [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "CRON_SECRET",
    "SLA_THRESHOLD_DAYS",
    "SLA_REMINDER_INTERVAL_DAYS"
  ],

  "businessRules": {
    "triggers": {
      "CLAIM_ASSIGNED": {
        "recipients": ["HANDLER (assigné)"],
        "fallback": "tous MANAGER si pas de HANDLER assigné",
        "defaultEmail": { "HANDLER": false, "MANAGER": false, "ADMIN": false }
      },
      "STATUS_CHANGED": {
        "recipients": ["HANDLER (assigné)", "tous MANAGER"],
        "fallback": "tous MANAGER si pas de HANDLER assigné",
        "defaultEmail": { "HANDLER": false, "MANAGER": false, "ADMIN": false }
      },
      "FRAUD_ALERT": {
        "recipients": ["tous MANAGER", "tous ADMIN"],
        "condition": "fraudScore > 70",
        "deduplication": "une seule fois par sinistre tant que score > 70",
        "defaultEmail": { "MANAGER": true, "ADMIN": true }
      },
      "SLA_BREACH": {
        "recipients": ["HANDLER (assigné)", "tous MANAGER"],
        "condition": "updatedAt < now() - SLA_THRESHOLD_DAYS jours, statuts actifs uniquement",
        "deduplication": "intervalle minimum SLA_REMINDER_INTERVAL_DAYS entre deux notifications pour le même sinistre",
        "defaultEmail": { "MANAGER": true }
      },
      "DOCUMENT_UPLOADED_BY_POLICYHOLDER": {
        "recipients": ["HANDLER (assigné)"],
        "fallback": "tous MANAGER si pas de HANDLER assigné",
        "defaultEmail": { "HANDLER": false, "MANAGER": false }
      }
    },
    "deduplication": {
      "FRAUD_ALERT": "Check existence Notification non-archivée de type FRAUD_ALERT pour le claimId avant création",
      "SLA_BREACH": "Check dernière Notification SLA_BREACH pour ce claimId créée dans les SLA_REMINDER_INTERVAL_DAYS derniers jours"
    },
    "slaActiveStatuses": ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"],
    "policyholdersBlocked": true,
    "existingEmailNotificationPreserved": true
  },

  "auditTrail": [
    { "action": "NOTIFICATION_READ", "entity": "NOTIFICATION", "priority": "SHOULD" },
    { "action": "FRAUD_ALERT_SENT", "entity": "NOTIFICATION", "priority": "MUST" },
    { "action": "SLA_BREACH_DETECTED", "entity": "CLAIM", "priority": "MUST" }
  ],

  "testScope": {
    "unit": [
      "notification-service.ts : triggerNotification, deduplication FRAUD_ALERT, deduplication SLA",
      "email-service.ts : sendAsync, gestion SMTP absent",
      "sla-cron.ts : checkSLABreaches, filtrage statuts, batch processing"
    ],
    "integration": [
      "GET /api/notifications : filtrage par userId, pagination",
      "PATCH /api/notifications/:id : ownership check",
      "PATCH /api/notifications (bulk read)",
      "POST /api/cron/sla-check : CRON_SECRET validation"
    ],
    "e2e": [
      "Badge Navbar s'incrémente après assignation",
      "Notification disparaît du badge après lecture",
      "Email envoyé lors d'une alerte fraude (mock SMTP)"
    ]
  }
}
```

---

*Ce fichier est la source de vérité fonctionnelle pour la feature `notifications-alertes`. Tout changement de règles métier doit être reflété ici avant implémentation.*

*Prochaine étape : `/architect notifications-alertes` → contrats API détaillés + migration Prisma + plan d'implémentation par équipe.*
