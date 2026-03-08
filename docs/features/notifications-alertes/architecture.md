# Architecture technique — Notifications & Alertes

**Feature :** `notifications-alertes`
**Version :** 1.0
**Date :** 2026-03-08
**Statut :** Prêt pour implémentation
**Agent :** Architecte
**Dépend de :** `ba-specs.md` v1.0

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Modèles Prisma](#2-modèles-prisma)
3. [Contrats API — 7 routes](#3-contrats-api--7-routes)
4. [NotificationService](#4-notificationservice)
5. [EmailService — extension](#5-emailservice--extension)
6. [SLA Cron](#6-sla-cron)
7. [Composants frontend](#7-composants-frontend)
8. [Graphe de dépendances](#8-graphe-de-dépendances)
9. [Routes existantes à modifier](#9-routes-existantes-à-modifier)
10. [Middleware — mise à jour](#10-middleware--mise-à-jour)
11. [Types partagés — extension](#11-types-partagés--extension)
12. [Plan d'implémentation par équipe](#12-plan-dimplémentation-par-équipe)
13. [Definition of Done (DoD)](#13-definition-of-done-dod)
14. [JSON Handoff implémentation](#14-json-handoff-implémentation)

---

## 1. Vue d'ensemble

### 1.1 Périmètre technique

La feature `notifications-alertes` introduit un système de notifications in-app pour les agents internes (HANDLER, MANAGER, ADMIN). Elle repose sur :

- **2 nouveaux modèles Prisma** : `Notification` + `NotificationPreference`
- **7 nouvelles routes API** sous `/api/notifications/`
- **1 nouveau service** : `src/lib/notification-service.ts`
- **Extension** de `src/lib/email-service.ts` (templates agents internes)
- **1 service cron** : `src/lib/sla-cron.ts` + route dédiée `GET /api/notifications/check-sla`
- **2 composants React** : `NotificationBadge` + `NotificationDropdown`
- **3 routes existantes modifiées** : `/api/claims/[id]/assign`, `/api/claims/[id]/analyze`, `/api/portail/claims/[id]/documents`

### 1.2 Invariants d'architecture

| Invariant | Règle |
|-----------|-------|
| Auth-first | `auth()` est le premier appel dans chaque handler de route |
| Zod sur 100% des entrées | Query params et body validés avant tout accès Prisma |
| Audit trail | `createAuditLog()` après toute mutation |
| Email async | Jamais de `await` bloquant sur l'envoi email dans la réponse HTTP |
| Isolation userId | Toute lecture de notification filtre sur `userId = session.user.id` |
| POLICYHOLDER bloqué | Guard explicite HTTP 403 avant la logique métier dans toutes les routes `/api/notifications/*` |
| TypeScript strict | Zéro `any` — tous les types via `src/types/index.ts` |

---

## 2. Modèles Prisma

### 2.1 Modèle `Notification`

```prisma
model Notification {
  id          String    @id @default(cuid())
  type        String    // CLAIM_ASSIGNED | STATUS_CHANGED | FRAUD_ALERT | SLA_BREACH | DOCUMENT_UPLOADED_BY_POLICYHOLDER
  status      String    @default("UNREAD") // UNREAD | READ
  priority    String    @default("NORMAL") // LOW | NORMAL | HIGH | CRITICAL
  title       String
  message     String
  metadata    String?   // JSON string : { claimId?, claimNumber?, previousStatus?, newStatus?, fraudScore?, daysOverdue?, documentId?, filename?, uploadedBy? }
  readAt      DateTime?
  archivedAt  DateTime?

  // Destinataire
  userId      String
  user        User      @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)

  // Sinistre lié (optionnel)
  claimId     String?
  claim       Claim?    @relation("ClaimNotifications", fields: [claimId], references: [id], onDelete: SetNull)

  // Tracking email
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

**Notes d'index :**
- `[userId, status]` — requête principale du badge et de la liste filtrée
- `[type, claimId]` — déduplication FRAUD_ALERT (lookup rapide)
- `[createdAt]` — archivage automatique 90 jours

### 2.2 Modèle `NotificationPreference`

```prisma
model NotificationPreference {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation("UserNotificationPreferences", fields: [userId], references: [id], onDelete: Cascade)
  type          String   // CLAIM_ASSIGNED | STATUS_CHANGED | FRAUD_ALERT | SLA_BREACH | DOCUMENT_UPLOADED_BY_POLICYHOLDER
  inAppEnabled  Boolean  @default(true)
  emailEnabled  Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, type])
  @@index([userId])
}
```

### 2.3 Modifications des modèles existants

**`User`** — ajout de 2 relations nommées :
```prisma
notifications            Notification[]           @relation("UserNotifications")
notificationPreferences  NotificationPreference[] @relation("UserNotificationPreferences")
```

**`Claim`** — ajout de 1 relation nommée :
```prisma
notifications  Notification[] @relation("ClaimNotifications")
```

**`AuditLog`** — aucune modification structurelle. Les nouvelles actions sont ajoutées au type `AuditAction` dans `src/types/index.ts` (voir §11).

### 2.4 Valeurs par défaut des préférences par rôle

| Type | HANDLER inApp | HANDLER email | MANAGER inApp | MANAGER email | ADMIN inApp | ADMIN email |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| CLAIM_ASSIGNED | true | false | true | false | true | false |
| STATUS_CHANGED | true | false | true | false | true | false |
| FRAUD_ALERT | true | false | true | **true** | true | **true** |
| SLA_BREACH | true | false | true | **true** | true | false |
| DOCUMENT_UPLOADED_BY_POLICYHOLDER | true | false | true | false | false | false |

### 2.5 Commande de migration

```bash
npx prisma migrate dev --name add-notifications
```

Aucune donnée existante n'est modifiée. La table `EmailNotification` reste intacte.

---

## 3. Contrats API — 7 routes

### Convention commune à toutes les routes

```typescript
// Pattern d'authentification obligatoire (auth-first)
const session = await auth();
if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

// Guard POLICYHOLDER (toutes les routes /api/notifications/*)
if (session.user.role === "POLICYHOLDER") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

### Route 1 — GET /api/notifications

**Fichier :** `src/app/api/notifications/route.ts` (handler GET)

**Description :** Liste paginée des notifications de l'utilisateur connecté, avec cursor-based pagination.

**Schéma Zod — query params :**
```typescript
export const GetNotificationsQuerySchema = z.object({
  status: z.enum(["UNREAD", "READ"]).optional(),
  type: z.enum([
    "CLAIM_ASSIGNED",
    "STATUS_CHANGED",
    "FRAUD_ALERT",
    "SLA_BREACH",
    "DOCUMENT_UPLOADED_BY_POLICYHOLDER",
  ]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().cuid().optional(), // CUID du dernier élément retourné
});
```

**Logique :**
1. `auth()` + guard POLICYHOLDER (403)
2. Valider query params via `GetNotificationsQuerySchema.safeParse()`
3. Requête Prisma `findMany` filtrant sur `userId = session.user.id`, `archivedAt: null`
4. Si `cursor` présent : `cursor: { id: cursor }, skip: 1`
5. Requête parallèle `count` pour `unreadCount` (filtre `status = UNREAD`, même userId)
6. Retourner `{ notifications, unreadCount, nextCursor }` (`nextCursor = null` si dernier batch)

**Réponse 200 :**
```typescript
type GetNotificationsResponse = {
  notifications: NotificationWithClaim[];
  unreadCount: number;
  nextCursor: string | null;
};
```

**Codes HTTP :**
| Code | Cas |
|------|-----|
| 200 | Succès (liste vide incluse) |
| 400 | Query params invalides |
| 401 | Session absente |
| 403 | Rôle POLICYHOLDER |

**Include Prisma :**
```typescript
const NOTIFICATION_INCLUDE = {
  claim: { select: { id: true, claimNumber: true, status: true } },
} as const;
```

---

### Route 2 — PATCH /api/notifications/[id]/read

**Fichier :** `src/app/api/notifications/[id]/read/route.ts`

**Description :** Marque une notification comme lue. Ownership strictement vérifié.

**Schéma Zod — body :**
```typescript
// Pas de body requis — l'action "read" est implicite dans l'URL
// Optionnel si on veut laisser ouvert à d'autres transitions futures :
export const MarkReadBodySchema = z.object({}).strict();
```

**Logique :**
1. `auth()` + guard POLICYHOLDER (403)
2. `params` → `id` (CUID de la notification)
3. `findUnique` sur `Notification` par `id`
4. Si absent → 404
5. Si `notification.userId !== session.user.id` → 403
6. Si `notification.status === "READ"` → 200 immédiat (idempotent)
7. `update` : `status: "READ"`, `readAt: new Date()`
8. `createAuditLog` avec `action: "NOTIFICATION_READ"` (SHOULD — non bloquant)
9. Retourner la notification mise à jour

**Réponse 200 :**
```typescript
{ data: Notification }
```

**Codes HTTP :**
| Code | Cas |
|------|-----|
| 200 | Succès (y compris si déjà READ — idempotent) |
| 401 | Session absente |
| 403 | POLICYHOLDER ou notification appartenant à un autre user |
| 404 | Notification introuvable |

---

### Route 3 — PATCH /api/notifications/read-all

**Fichier :** `src/app/api/notifications/read-all/route.ts`

**Description :** Marque toutes les notifications non lues de l'utilisateur connecté comme lues.

**Schéma Zod :** aucun body requis.

**Logique :**
1. `auth()` + guard POLICYHOLDER (403)
2. `updateMany` sur `Notification` où `userId = session.user.id AND status = "UNREAD" AND archivedAt IS NULL`
3. Setter `status: "READ"`, `readAt: new Date()`
4. Retourner `{ updated: count }`

**Réponse 200 :**
```typescript
{ data: { updated: number } }
```

**Codes HTTP :**
| Code | Cas |
|------|-----|
| 200 | Succès (count = 0 si aucune UNREAD) |
| 401 | Session absente |
| 403 | Rôle POLICYHOLDER |

**Note :** Pas d'audit log sur le bulk-read (volume trop élevé). Conforme NR-30 (SHOULD).

---

### Route 4 — GET /api/notifications/unread-count

**Fichier :** `src/app/api/notifications/unread-count/route.ts`

**Description :** Endpoint léger pour le badge Navbar. Polling toutes les 60 secondes côté client. Réponse cible < 50 ms.

**Schéma Zod :** aucun paramètre.

**Logique :**
1. `auth()` + guard POLICYHOLDER (403)
2. `count` Prisma : `userId = session.user.id AND status = "UNREAD" AND archivedAt IS NULL`
3. Retourner `{ unreadCount }` — valeur cappée à 99 pour l'affichage (le raw count est retourné, le cap est fait côté client)

**Réponse 200 :**
```typescript
{ unreadCount: number }
```

**Headers de cache :** `Cache-Control: no-store` (données temps réel).

**Codes HTTP :**
| Code | Cas |
|------|-----|
| 200 | Succès |
| 401 | Session absente |
| 403 | Rôle POLICYHOLDER |

---

### Route 5 — GET /api/notifications/check-sla

**Fichier :** `src/app/api/notifications/check-sla/route.ts`

**Description :** Déclenche le job de vérification SLA. Protégé par header `x-cron-secret`. Pas de session JWT requise.

**Authentification :** Header `x-cron-secret` comparé à `process.env.CRON_SECRET` (comparaison en temps constant via `crypto.timingSafeEqual`).

**Schéma Zod :** aucun body.

**Logique :**
1. Lire `req.headers.get("x-cron-secret")`
2. Comparer avec `process.env.CRON_SECRET` via `timingSafeEqual` sur buffers UTF-8
3. Si mismatch → 401 `{ error: "Unauthorized" }`
4. Appeler `checkSLABreaches()` depuis `src/lib/sla-cron.ts`
5. Retourner le log structuré JSON du cron

**Réponse 200 :**
```typescript
{
  data: {
    timestamp: string;       // ISO 8601
    job: "sla-breach-check";
    claimsChecked: number;
    breachesDetected: number;
    notificationsCreated: number;
    emailsSent: number;
    errors: string[];
    durationMs: number;
  }
}
```

**Codes HTTP :**
| Code | Cas |
|------|-----|
| 200 | Succès (même si 0 breach détecté) |
| 401 | Secret absent ou invalide |
| 500 | Erreur interne du cron |

**Note middleware :** Cette route ne passe pas par `auth()` NextAuth. Elle doit être ajoutée dans la liste des routes publiques du middleware (voir §10).

---

### Route 6 — GET /api/notifications/preferences

**Fichier :** `src/app/api/notifications/preferences/route.ts` (handler GET)

**Description :** Retourne toutes les préférences de notification de l'utilisateur connecté.

**Schéma Zod :** aucun paramètre.

**Logique :**
1. `auth()` + guard POLICYHOLDER (403)
2. `findMany` sur `NotificationPreference` où `userId = session.user.id`
3. Si aucun enregistrement (première connexion après migration) → appeler `createDefaultPreferences(userId, role)` puis retourner les nouvelles préférences
4. Retourner la liste triée par `type`

**Réponse 200 :**
```typescript
{ data: NotificationPreference[] }
```

**Codes HTTP :**
| Code | Cas |
|------|-----|
| 200 | Succès |
| 401 | Session absente |
| 403 | Rôle POLICYHOLDER |

---

### Route 7 — PATCH /api/notifications/preferences

**Fichier :** `src/app/api/notifications/preferences/route.ts` (handler PATCH)

**Description :** Met à jour une préférence de notification pour l'utilisateur connecté (ou pour un autre utilisateur si ADMIN).

**Schéma Zod — body :**
```typescript
export const UpdatePreferenceSchema = z.object({
  type: z.enum([
    "CLAIM_ASSIGNED",
    "STATUS_CHANGED",
    "FRAUD_ALERT",
    "SLA_BREACH",
    "DOCUMENT_UPLOADED_BY_POLICYHOLDER",
  ]),
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  targetUserId: z.string().cuid().optional(), // ADMIN uniquement (NR-26)
}).refine(
  (data) => data.inAppEnabled !== undefined || data.emailEnabled !== undefined,
  { message: "Au moins un champ (inAppEnabled ou emailEnabled) doit être fourni" }
);
```

**Logique :**
1. `auth()` + guard POLICYHOLDER (403)
2. Valider body via `UpdatePreferenceSchema.safeParse()`
3. Résoudre `targetUserId` :
   - Si `targetUserId` fourni ET `session.user.role !== "ADMIN"` → 403
   - Sinon `targetUserId = session.user.id`
4. `upsert` sur `NotificationPreference` (clé unique `[userId, type]`)
5. Retourner la préférence mise à jour

**Réponse 200 :**
```typescript
{ data: NotificationPreference }
```

**Codes HTTP :**
| Code | Cas |
|------|-----|
| 200 | Succès |
| 400 | Body invalide (Zod) |
| 401 | Session absente |
| 403 | POLICYHOLDER ou HANDLER/MANAGER essayant de modifier les prefs d'un autre |

---

## 4. NotificationService

**Fichier :** `src/lib/notification-service.ts`

### 4.1 Interface publique

```typescript
// Types internes
export type NotificationType =
  | "CLAIM_ASSIGNED"
  | "STATUS_CHANGED"
  | "FRAUD_ALERT"
  | "SLA_BREACH"
  | "DOCUMENT_UPLOADED_BY_POLICYHOLDER";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  claimId?: string;
  metadata?: Record<string, unknown>;
}

// Fonctions exportées
export async function createNotification(
  userId: string,
  payload: NotificationPayload
): Promise<Notification | null>

export async function sendEmailNotification(
  notification: Notification,
  user: UserSummary
): Promise<void>

export async function checkSLABreaches(): Promise<SLACronResult>

export async function createDefaultPreferences(
  userId: string,
  role: string
): Promise<NotificationPreference[]>

// Déclencheurs métier (appelés depuis les routes existantes)
export async function triggerClaimAssigned(
  claimId: string,
  assignedUserId: string
): Promise<void>

export async function triggerStatusChanged(
  claimId: string,
  previousStatus: string,
  newStatus: string,
  triggeredBy: string
): Promise<void>

export async function triggerFraudAlert(
  claimId: string,
  fraudScore: number,
  fraudRisk: string
): Promise<void>

export async function triggerDocumentUploaded(
  claimId: string,
  documentId: string,
  filename: string,
  uploadedByName: string
): Promise<void>
```

### 4.2 Logique de `createNotification()`

```
1. Vérifier que l'utilisateur est actif (active = true)
2. Vérifier que user.role !== "POLICYHOLDER" (guard silencieux)
3. Lire NotificationPreference { userId, type }
   → Si absente : utiliser defaults (inAppEnabled=true, emailEnabled=false)
4. Si inAppEnabled = false → ne pas créer la notification in-app, mais continuer pour email
5. Créer Notification en base (si inAppEnabled = true)
6. Si emailEnabled = true ET SMTP configuré :
   → Appeler sendEmailNotification() via Promise (non awaité — fire-and-forget)
7. Retourner la notification créée (ou null si inAppEnabled = false)
```

### 4.3 Logique de déduplication

**FRAUD_ALERT :**
```typescript
// Avant création : vérifier existence
const existing = await prisma.notification.findFirst({
  where: {
    type: "FRAUD_ALERT",
    claimId,
    archivedAt: null,
  },
});
if (existing) return; // NR-04 : pas de re-déclenchement
```

**SLA_BREACH :**
```typescript
// Par destinataire : vérifier dernière SLA_BREACH < 7 jours
const recentSLA = await prisma.notification.findFirst({
  where: {
    type: "SLA_BREACH",
    claimId,
    userId,
    createdAt: { gte: subDays(new Date(), SLA_REMINDER_INTERVAL_DAYS) },
  },
});
if (recentSLA) continue; // NR-08 : skip ce destinataire
```

### 4.4 Logique de `triggerFraudAlert()`

```
1. Vérifier fraudScore > 70 (sinon return)
2. Déduplication FRAUD_ALERT (requête Prisma — any recipient, same claimId)
3. Récupérer tous MANAGER actifs + tous ADMIN actifs
4. Pour chaque destinataire :
   a. createNotification(userId, { type: "FRAUD_ALERT", priority: "CRITICAL", ... })
5. createAuditLog({ action: "FRAUD_ALERT_SENT", ... }) — MUST (NR-31)
```

### 4.5 Logique de `triggerStatusChanged()`

```
1. Vérifier previousStatus !== newStatus (NR edge case)
2. Récupérer sinistre avec assignedToID
3. Destinataires :
   - Si assignedToID : [assignedTo]
   - Tous MANAGER actifs
   - Fallback : si no assignedTo → tous MANAGER seulement (NR-09)
   - Dédupliquer la liste (un MANAGER assigné ne reçoit pas 2 notifs)
4. Pour chaque destinataire unique : createNotification()
```

### 4.6 Logique de `createDefaultPreferences()`

Appelée depuis :
- `POST /api/admin/users` (création de compte)
- `GET /api/notifications/preferences` (lazy-init si manquantes)

```typescript
const DEFAULTS_BY_ROLE: Record<string, Array<{
  type: NotificationType;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}>> = {
  HANDLER: [
    { type: "CLAIM_ASSIGNED",                      inAppEnabled: true,  emailEnabled: false },
    { type: "STATUS_CHANGED",                      inAppEnabled: true,  emailEnabled: false },
    { type: "FRAUD_ALERT",                         inAppEnabled: true,  emailEnabled: false },
    { type: "SLA_BREACH",                          inAppEnabled: true,  emailEnabled: false },
    { type: "DOCUMENT_UPLOADED_BY_POLICYHOLDER",   inAppEnabled: true,  emailEnabled: false },
  ],
  MANAGER: [
    { type: "CLAIM_ASSIGNED",                      inAppEnabled: true,  emailEnabled: false },
    { type: "STATUS_CHANGED",                      inAppEnabled: true,  emailEnabled: false },
    { type: "FRAUD_ALERT",                         inAppEnabled: true,  emailEnabled: true  },
    { type: "SLA_BREACH",                          inAppEnabled: true,  emailEnabled: true  },
    { type: "DOCUMENT_UPLOADED_BY_POLICYHOLDER",   inAppEnabled: true,  emailEnabled: false },
  ],
  ADMIN: [
    { type: "CLAIM_ASSIGNED",                      inAppEnabled: true,  emailEnabled: false },
    { type: "STATUS_CHANGED",                      inAppEnabled: true,  emailEnabled: false },
    { type: "FRAUD_ALERT",                         inAppEnabled: true,  emailEnabled: true  },
    { type: "SLA_BREACH",                          inAppEnabled: true,  emailEnabled: false },
    { type: "DOCUMENT_UPLOADED_BY_POLICYHOLDER",   inAppEnabled: false, emailEnabled: false },
  ],
};
```

Utiliser `createMany` avec `skipDuplicates: true` pour l'idempotence.

---

## 5. EmailService — extension

**Fichier :** `src/lib/email-service.ts` (extension, pas remplacement)

### 5.1 Nouvelles fonctions à ajouter

```typescript
// Envoi asynchrone non bloquant (fire-and-forget avec log d'erreur)
export async function sendNotificationEmail(
  notification: Notification,
  user: { email: string; name: string }
): Promise<void>

// Templates par type
function buildEmailContent(
  type: NotificationType,
  metadata: Record<string, unknown>
): { subject: string; body: string }
```

### 5.2 Templates par type de notification

| Type | Sujet | Corps (variables) |
|------|-------|-------------------|
| `CLAIM_ASSIGNED` | `[ClaimFlow] Sinistre {claimNumber} vous a été assigné` | claimNumber, claimType, incidentDate, policyholderName |
| `STATUS_CHANGED` | `[ClaimFlow] Statut du sinistre {claimNumber} : {newStatus}` | claimNumber, previousStatus, newStatus, updatedBy |
| `FRAUD_ALERT` | `[ClaimFlow] ALERTE FRAUDE — {claimNumber} (score : {fraudScore})` | claimNumber, fraudScore, fraudRisk, claimType |
| `SLA_BREACH` | `[ClaimFlow] SLA dépassé — {claimNumber} en attente depuis {daysOverdue}j` | claimNumber, daysOverdue, currentStatus, assignedTo |
| `DOCUMENT_UPLOADED_BY_POLICYHOLDER` | `[ClaimFlow] Nouveau document sur le sinistre {claimNumber}` | claimNumber, filename, uploadedBy, uploadedAt |

### 5.3 Pattern d'envoi asynchrone (NR-21)

```typescript
export async function sendNotificationEmail(
  notification: Notification,
  user: { email: string; name: string }
): Promise<void> {
  if (!process.env.SMTP_HOST) {
    // Mode log-only — pas d'erreur, juste un warning
    await prisma.notification.update({
      where: { id: notification.id },
      data: { emailError: "SMTP_NOT_CONFIGURED" },
    });
    return;
  }

  const { subject, body } = buildEmailContent(
    notification.type as NotificationType,
    JSON.parse(notification.metadata ?? "{}")
  );

  try {
    // Timeout 10 secondes (NR-20)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "ClaimFlow AI <noreply@claimflow.ai>",
      to: user.email,
      subject,
      text: body,
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: { emailSent: true, emailSentAt: new Date() },
    });
  } catch (err) {
    // NR-20 : log l'erreur, ne bloque pas
    await prisma.notification.update({
      where: { id: notification.id },
      data: { emailError: String(err) },
    });
  }
}
```

**Pattern fire-and-forget dans NotificationService :**
```typescript
// Ne jamais faire : await sendNotificationEmail(...)
// Toujours faire :
void sendNotificationEmail(notification, user).catch(console.error);
```

---

## 6. SLA Cron

**Fichier :** `src/lib/sla-cron.ts`

### 6.1 Interface

```typescript
export interface SLACronResult {
  timestamp: string;
  job: "sla-breach-check";
  claimsChecked: number;
  breachesDetected: number;
  notificationsCreated: number;
  emailsSent: number;
  errors: string[];
  durationMs: number;
}

export async function checkSLABreaches(): Promise<SLACronResult>
```

### 6.2 Algorithme

```
const SLA_DAYS = Number(process.env.SLA_THRESHOLD_DAYS ?? 30)
const REMINDER_DAYS = Number(process.env.SLA_REMINDER_INTERVAL_DAYS ?? 7)
const BATCH_SIZE = 50
const ACTIVE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"]
const cutoffDate = subDays(new Date(), SLA_DAYS)

1. Compter le total : Claim WHERE status IN ACTIVE_STATUSES AND updatedAt < cutoffDate
2. Traiter par batch de 50 (cursor-based sur claim.id) :
   Pour chaque sinistre :
   a. Calculer daysOverdue = ceil((now - updatedAt) / 86400000) - SLA_DAYS
   b. Pour chaque destinataire (assignedTo + tous MANAGER, avec fallback) :
      i.  Vérifier dernière SLA_BREACH pour ce [claimId, userId] < REMINDER_DAYS → skip
      ii. createNotification()
      iii. Incrémenter notificationsCreated
   c. createAuditLog({ action: "SLA_BREACH_DETECTED", claimId, ... })
3. Retourner SLACronResult
```

### 6.3 Route dédiée

**Fichier :** `src/app/api/notifications/check-sla/route.ts`

```typescript
import crypto from "crypto";
import { checkSLABreaches } from "@/lib/sla-cron";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET ?? "";

  // Comparaison en temps constant (protection timing attack)
  if (!secret || !timingSafeEqual(secret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkSLABreaches();
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
```

### 6.4 Variables d'environnement

```env
CRON_SECRET="claimflow-cron-secret-changeme-in-production"
SLA_THRESHOLD_DAYS=30
SLA_REMINDER_INTERVAL_DAYS=7
```

---

## 7. Composants frontend

### 7.1 NotificationBadge

**Fichier :** `src/components/NotificationBadge.tsx`

**Responsabilités :**
- Polling `GET /api/notifications/unread-count` toutes les 60 secondes
- Afficher le badge (masqué si count = 0, `99+` si count > 99)
- Déclencher l'ouverture du `NotificationDropdown`
- Invisible pour les POLICYHOLDER (vérification du rôle session)

**Props :** `{}` (auto-suffisant via session)

**États internes :**
```typescript
const [unreadCount, setUnreadCount] = useState(0);
const [isOpen, setIsOpen] = useState(false);
const [notifications, setNotifications] = useState<NotificationItem[]>([]);
```

**Polling :**
```typescript
useEffect(() => {
  const fetchCount = async () => {
    const res = await fetch("/api/notifications/unread-count");
    if (res.ok) {
      const data = await res.json();
      setUnreadCount(data.unreadCount);
    }
  };
  fetchCount(); // initial
  const interval = setInterval(fetchCount, 60_000);
  return () => clearInterval(interval);
}, []);
```

**Affichage du badge :**
```typescript
const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);
```

### 7.2 NotificationDropdown

**Fichier :** `src/components/NotificationDropdown.tsx`

**Responsabilités :**
- Afficher les 10 dernières notifications non lues (`GET /api/notifications?status=UNREAD&limit=10`)
- Marquer une notification comme lue au clic (`PATCH /api/notifications/[id]/read`)
- Naviguer vers `/claims/[claimId]` après lecture si `claimId` présent
- Lien "Tout marquer comme lu" (`PATCH /api/notifications/read-all`)

**Props :**
```typescript
interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange: (count: number) => void; // callback pour mettre à jour le badge parent
}
```

**Icônes par type (Lucide React) :**
| Type | Icône | Classe Tailwind couleur |
|------|-------|------------------------|
| `CLAIM_ASSIGNED` | `UserCheck` | `text-blue-500` |
| `STATUS_CHANGED` | `RefreshCw` | `text-green-500` |
| `FRAUD_ALERT` | `AlertTriangle` | `text-red-500` |
| `SLA_BREACH` | `Clock` | `text-orange-500` |
| `DOCUMENT_UPLOADED_BY_POLICYHOLDER` | `FileText` | `text-purple-500` |

### 7.3 Intégration dans Navbar

**Fichier :** `src/components/Navbar.tsx` (modification)

```typescript
// Ajouter dans le JSX, uniquement si role !== "POLICYHOLDER"
{session?.user.role !== "POLICYHOLDER" && <NotificationBadge />}
```

---

## 8. Graphe de dépendances

```
schema.prisma (Notification + NotificationPreference)
    │
    ├─── src/lib/notification-service.ts
    │         │
    │         ├─── src/lib/email-service.ts (sendNotificationEmail)
    │         ├─── src/lib/audit.ts (createAuditLog)
    │         └─── src/lib/prisma.ts
    │
    ├─── src/lib/sla-cron.ts
    │         │
    │         └─── src/lib/notification-service.ts
    │
    ├─── src/app/api/notifications/route.ts                (GET liste)
    ├─── src/app/api/notifications/[id]/read/route.ts      (PATCH read)
    ├─── src/app/api/notifications/read-all/route.ts       (PATCH bulk)
    ├─── src/app/api/notifications/unread-count/route.ts   (GET count)
    ├─── src/app/api/notifications/check-sla/route.ts      (GET cron)
    ├─── src/app/api/notifications/preferences/route.ts    (GET + PATCH)
    │
    ├─── Routes existantes modifiées :
    │         ├─── src/app/api/claims/[id]/assign/route.ts
    │         │         └─── notification-service.triggerClaimAssigned()
    │         ├─── src/app/api/claims/[id]/status/route.ts
    │         │         └─── notification-service.triggerStatusChanged()
    │         ├─── src/app/api/claims/[id]/analyze/route.ts
    │         │         └─── notification-service.triggerFraudAlert()
    │         └─── src/app/api/portail/claims/[id]/documents/route.ts
    │                   └─── notification-service.triggerDocumentUploaded()
    │
    └─── src/components/
              ├─── NotificationBadge.tsx → GET /api/notifications/unread-count
              └─── NotificationDropdown.tsx
                        ├─── GET /api/notifications
                        ├─── PATCH /api/notifications/[id]/read
                        └─── PATCH /api/notifications/read-all
```

---

## 9. Routes existantes à modifier

### 9.1 `POST /api/claims/[id]/assign` — ajout CLAIM_ASSIGNED

**Fichier :** `src/app/api/claims/[id]/assign/route.ts`

Ajouter après le `createAuditLog` existant :

```typescript
// Déclencher notification (fire-and-forget — NR-21)
void triggerClaimAssigned(
  claim.id,
  parsed.data.userId
).catch(console.error);
```

**Contrainte :** L'appel `triggerClaimAssigned` ne doit jamais bloquer le `return NextResponse.json()`.

### 9.2 `PATCH /api/claims/[id]/status` — ajout STATUS_CHANGED

**Fichier :** `src/app/api/claims/[id]/status/route.ts`

Ajouter après le `createAuditLog` existant :

```typescript
void triggerStatusChanged(
  claim.id,
  claim.status,          // previousStatus (avant update)
  newStatus,
  session.user.id
).catch(console.error);
```

### 9.3 `POST /api/claims/[id]/analyze` — ajout FRAUD_ALERT

**Fichier :** `src/app/api/claims/[id]/analyze/route.ts`

Ajouter après la sauvegarde du fraudScore en base (section "2. Analyze fraud risk") :

```typescript
// Après prisma.claim.update({ fraudScore, fraudRisk })
const fraudResult = results.fraud as { score: number; risk: string } | undefined;
if (fraudResult && fraudResult.score > 70) {
  void triggerFraudAlert(
    id,
    fraudResult.score,
    fraudResult.risk
  ).catch(console.error);
}
```

**Contrainte :** Appel conditionnel sur `fraudScore > 70`. La déduplication est dans `triggerFraudAlert()`, pas dans la route.

### 9.4 `POST /api/portail/claims/[id]/documents` — ajout DOCUMENT_UPLOADED_BY_POLICYHOLDER

**Fichier :** `src/app/api/portail/claims/[id]/documents/route.ts`

Ajouter après le `createAuditLog` existant :

```typescript
// Récupérer le nom de l'assuré depuis la session ou le profil
const policyholderName = session.user.name ?? "Assuré";

void triggerDocumentUploaded(
  id,
  document.id,
  file.name,
  policyholderName
).catch(console.error);
```

---

## 10. Middleware — mise à jour

**Fichier :** `src/middleware.ts`

### 10.1 Ajouter la permission `/api/notifications`

```typescript
// Dans ROUTE_PERMISSIONS
"/api/notifications": ["HANDLER", "MANAGER", "ADMIN"],
```

**Note :** Le guard POLICYHOLDER explicite (HTTP 403) est redondant avec le middleware mais requis par NR-29. Les deux layers de protection doivent coexister.

### 10.2 Exclure la route cron du middleware auth

```typescript
// Dans la liste des routes publiques (avant le check !req.auth)
if (pathname === "/api/notifications/check-sla") {
  return NextResponse.next(); // Auth via x-cron-secret, pas JWT
}
```

---

## 11. Types partagés — extension

**Fichier :** `src/types/index.ts`

### 11.1 Nouveaux types à ajouter

```typescript
// Types notifications
export type NotificationType =
  | "CLAIM_ASSIGNED"
  | "STATUS_CHANGED"
  | "FRAUD_ALERT"
  | "SLA_BREACH"
  | "DOCUMENT_UPLOADED_BY_POLICYHOLDER";

export type NotificationStatus = "UNREAD" | "READ";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata: string | null;
  readAt: string | null;
  archivedAt: string | null;
  userId: string;
  claimId: string | null;
  claim: { id: string; claimNumber: string; status: string } | null;
  emailSent: boolean;
  emailSentAt: string | null;
  emailError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferenceItem {
  id: string;
  userId: string;
  type: NotificationType;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 11.2 Extension du type `AuditAction`

```typescript
// Ajouter aux valeurs existantes :
export type AuditAction =
  | "CLAIM_CREATED"
  | "CLAIM_UPDATED"
  // ... (existants) ...
  | "DOCUMENT_UPLOADED_BY_POLICYHOLDER"
  | "NOTIFICATION_READ"        // NOUVEAU — NR-30
  | "FRAUD_ALERT_SENT"         // NOUVEAU — NR-31
  | "SLA_BREACH_DETECTED";     // NOUVEAU — NR-07
```

### 11.3 Variables d'environnement (`.env.local`)

```env
# Déjà présentes (email-service.ts existant)
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="notifications@claimflow.ai"
SMTP_PASS="..."
SMTP_FROM="ClaimFlow AI <notifications@claimflow.ai>"

# Nouvelles
CRON_SECRET="claimflow-cron-secret-changeme-in-production"
SLA_THRESHOLD_DAYS=30
SLA_REMINDER_INTERVAL_DAYS=7
```

---

## 12. Plan d'implémentation par équipe

### Ordre strict des dépendances (chaque étape débloque la suivante)

```
Étape 1 (Migration)    → Étape 2 (Service)    → Étape 3 (Routes)
        ↓                       ↓                       ↓
   Prisma schema          notification-service.ts    7 routes API
   + migrate dev           + email-service ext.      + routes modifiées
   + types/index.ts        + sla-cron.ts
```

### Étape 1 — Migration & Types (Backend)

**Durée estimée :** 2h

| Tâche | Fichier | Priorité |
|-------|---------|----------|
| Ajouter modèles `Notification` + `NotificationPreference` au schema | `prisma/schema.prisma` | MUST |
| Modifier modèles `User` et `Claim` (relations nommées) | `prisma/schema.prisma` | MUST |
| Lancer `npx prisma migrate dev --name add-notifications` | — | MUST |
| Ajouter `NotificationType`, `NotificationStatus`, `NotificationPriority`, `NotificationItem`, `NotificationPreferenceItem` | `src/types/index.ts` | MUST |
| Ajouter les 3 nouvelles `AuditAction` | `src/types/index.ts` | MUST |
| Ajouter les nouvelles `NotificationPreferenceItem` | `src/types/index.ts` | MUST |

### Étape 2 — Services (Backend)

**Durée estimée :** 4h

| Tâche | Fichier | Priorité |
|-------|---------|----------|
| Créer `notification-service.ts` : `createNotification()`, `createDefaultPreferences()` | `src/lib/notification-service.ts` | MUST |
| Implémenter `triggerClaimAssigned()`, `triggerStatusChanged()`, `triggerFraudAlert()`, `triggerDocumentUploaded()` | `src/lib/notification-service.ts` | MUST |
| Implémenter déduplication FRAUD_ALERT et SLA_BREACH | `src/lib/notification-service.ts` | MUST |
| Étendre `email-service.ts` : `sendNotificationEmail()` + templates | `src/lib/email-service.ts` | MUST |
| Créer `sla-cron.ts` : `checkSLABreaches()` avec batch de 50 | `src/lib/sla-cron.ts` | MUST |

### Étape 3 — Routes API (Backend)

**Durée estimée :** 3h

| Tâche | Fichier | Priorité |
|-------|---------|----------|
| `GET /api/notifications` (liste paginée) | `src/app/api/notifications/route.ts` | MUST |
| `PATCH /api/notifications/[id]/read` | `src/app/api/notifications/[id]/read/route.ts` | MUST |
| `PATCH /api/notifications/read-all` | `src/app/api/notifications/read-all/route.ts` | MUST |
| `GET /api/notifications/unread-count` | `src/app/api/notifications/unread-count/route.ts` | MUST |
| `GET /api/notifications/check-sla` | `src/app/api/notifications/check-sla/route.ts` | MUST |
| `GET /api/notifications/preferences` | `src/app/api/notifications/preferences/route.ts` | MUST |
| `PATCH /api/notifications/preferences` | `src/app/api/notifications/preferences/route.ts` | MUST |
| Ajouter `"/api/notifications"` dans `ROUTE_PERMISSIONS` | `src/middleware.ts` | MUST |
| Exclure `/api/notifications/check-sla` du middleware auth JWT | `src/middleware.ts` | MUST |

### Étape 4 — Modification routes existantes (Backend)

**Durée estimée :** 1h

| Tâche | Fichier | Priorité |
|-------|---------|----------|
| Ajouter `triggerClaimAssigned()` (fire-and-forget) | `src/app/api/claims/[id]/assign/route.ts` | MUST |
| Ajouter `triggerStatusChanged()` (fire-and-forget) | `src/app/api/claims/[id]/status/route.ts` | MUST |
| Ajouter `triggerFraudAlert()` conditionnel sur score > 70 | `src/app/api/claims/[id]/analyze/route.ts` | MUST |
| Ajouter `triggerDocumentUploaded()` (fire-and-forget) | `src/app/api/portail/claims/[id]/documents/route.ts` | MUST |

### Étape 5 — Frontend (Frontend)

**Durée estimée :** 3h

| Tâche | Fichier | Priorité |
|-------|---------|----------|
| Créer `NotificationBadge.tsx` (polling 60s, badge visuel) | `src/components/NotificationBadge.tsx` | MUST |
| Créer `NotificationDropdown.tsx` (liste, mark-read, navigation) | `src/components/NotificationDropdown.tsx` | MUST |
| Intégrer `NotificationBadge` dans `Navbar.tsx` | `src/components/Navbar.tsx` | MUST |
| Créer page préférences (tableau inApp/email par type) | `src/app/notifications/preferences/page.tsx` | SHOULD |

### Étape 6 — Tests (QA)

**Durée estimée :** 4h

| Tâche | Fichier | Priorité |
|-------|---------|----------|
| Tests unitaires `notification-service.ts` : createNotification, déduplication, triggerFraudAlert | `tests/notification-service.test.ts` | MUST |
| Tests unitaires `sla-cron.ts` : filtrage statuts, déduplication 7j, batch | `tests/sla-cron.test.ts` | MUST |
| Tests d'intégration routes API (auth, pagination, ownership) | `tests/notifications.test.ts` | MUST |
| Test cron secret (401 sans header, 200 avec) | `tests/notifications.test.ts` | MUST |
| E2E Playwright : badge s'incrémente après assignation | `e2e/notifications.spec.ts` | SHOULD |

---

## 13. Definition of Done (DoD)

### Technique

- [ ] Migration Prisma appliquée sans erreur
- [ ] `npx prisma studio` : tables `Notification` et `NotificationPreference` visibles
- [ ] TypeScript compile sans erreur (`npx tsc --noEmit`)
- [ ] Zéro `any` dans les nouveaux fichiers
- [ ] Toutes les routes retournent HTTP 403 pour un POLICYHOLDER
- [ ] Route `check-sla` retourne 401 sans `x-cron-secret`
- [ ] Route `check-sla` retourne 401 si secret incorrect
- [ ] `createNotification()` ne crée pas de notif pour un utilisateur `active = false`
- [ ] `triggerFraudAlert()` ne crée pas de doublon sur le même sinistre
- [ ] Email envoyé en fire-and-forget (ne bloque pas la réponse HTTP)

### Fonctionnel

- [ ] Scénario Gherkin §5 : CLAIM_ASSIGNED crée notification pour le HANDLER assigné
- [ ] Scénario Gherkin §5 : STATUS_CHANGED crée notifications pour HANDLER assigné + tous MANAGER
- [ ] Scénario Gherkin §5 : FRAUD_ALERT créée une seule fois par sinistre (déduplication)
- [ ] Scénario Gherkin §5 : SLA_BREACH créée si sinistre actif > 30j, pas recréée avant 7j
- [ ] Badge Navbar affiche le bon count, disparaît à 0
- [ ] Préférences par défaut créées automatiquement (MANAGER a email FRAUD_ALERT + SLA = true)
- [ ] `GET /api/notifications` filtre strictement sur `userId = session.user.id`

### Qualité

- [ ] Coverage Vitest ≥ 60% sur `notification-service.ts` et `sla-cron.ts`
- [ ] Pas de régression sur les routes existantes (tests CI verts)
- [ ] Audit log sur FRAUD_ALERT_SENT (MUST — NR-31)
- [ ] Audit log sur SLA_BREACH_DETECTED (MUST — NR-07)

---

## 14. JSON Handoff implémentation

```json
{
  "feature": "notifications-alertes",
  "version": "1.0",
  "date": "2026-03-08",
  "architect": "Claude claude-sonnet-4-6",
  "status": "ready_for_implementation",

  "implementationOrder": [
    {
      "step": 1,
      "team": "backend",
      "label": "Migration & Types",
      "estimatedHours": 2,
      "files": [
        "prisma/schema.prisma",
        "src/types/index.ts"
      ],
      "commands": ["npx prisma migrate dev --name add-notifications"]
    },
    {
      "step": 2,
      "team": "backend",
      "label": "Services",
      "estimatedHours": 4,
      "files": [
        "src/lib/notification-service.ts",
        "src/lib/email-service.ts",
        "src/lib/sla-cron.ts"
      ],
      "blockedBy": [1]
    },
    {
      "step": 3,
      "team": "backend",
      "label": "Routes API (7 nouvelles)",
      "estimatedHours": 3,
      "files": [
        "src/app/api/notifications/route.ts",
        "src/app/api/notifications/[id]/read/route.ts",
        "src/app/api/notifications/read-all/route.ts",
        "src/app/api/notifications/unread-count/route.ts",
        "src/app/api/notifications/check-sla/route.ts",
        "src/app/api/notifications/preferences/route.ts",
        "src/middleware.ts"
      ],
      "blockedBy": [2]
    },
    {
      "step": 4,
      "team": "backend",
      "label": "Modification routes existantes",
      "estimatedHours": 1,
      "files": [
        "src/app/api/claims/[id]/assign/route.ts",
        "src/app/api/claims/[id]/status/route.ts",
        "src/app/api/claims/[id]/analyze/route.ts",
        "src/app/api/portail/claims/[id]/documents/route.ts"
      ],
      "blockedBy": [2]
    },
    {
      "step": 5,
      "team": "frontend",
      "label": "Composants React",
      "estimatedHours": 3,
      "files": [
        "src/components/NotificationBadge.tsx",
        "src/components/NotificationDropdown.tsx",
        "src/components/Navbar.tsx",
        "src/app/notifications/preferences/page.tsx"
      ],
      "blockedBy": [3]
    },
    {
      "step": 6,
      "team": "qa",
      "label": "Tests",
      "estimatedHours": 4,
      "files": [
        "tests/notification-service.test.ts",
        "tests/sla-cron.test.ts",
        "tests/notifications.test.ts",
        "e2e/notifications.spec.ts"
      ],
      "blockedBy": [4, 5]
    }
  ],

  "newFiles": [
    "src/lib/notification-service.ts",
    "src/lib/sla-cron.ts",
    "src/app/api/notifications/route.ts",
    "src/app/api/notifications/[id]/read/route.ts",
    "src/app/api/notifications/read-all/route.ts",
    "src/app/api/notifications/unread-count/route.ts",
    "src/app/api/notifications/check-sla/route.ts",
    "src/app/api/notifications/preferences/route.ts",
    "src/components/NotificationBadge.tsx",
    "src/components/NotificationDropdown.tsx",
    "src/app/notifications/preferences/page.tsx",
    "tests/notification-service.test.ts",
    "tests/sla-cron.test.ts",
    "tests/notifications.test.ts",
    "e2e/notifications.spec.ts"
  ],

  "modifiedFiles": [
    "prisma/schema.prisma",
    "src/types/index.ts",
    "src/lib/email-service.ts",
    "src/middleware.ts",
    "src/components/Navbar.tsx",
    "src/app/api/claims/[id]/assign/route.ts",
    "src/app/api/claims/[id]/status/route.ts",
    "src/app/api/claims/[id]/analyze/route.ts",
    "src/app/api/portail/claims/[id]/documents/route.ts"
  ],

  "newDependencies": [],

  "newEnvVars": [
    "CRON_SECRET",
    "SLA_THRESHOLD_DAYS",
    "SLA_REMINDER_INTERVAL_DAYS"
  ],

  "existingEnvVarsUsed": [
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"
  ],

  "apiRoutes": {
    "GET /api/notifications": {
      "auth": "JWT (HANDLER|MANAGER|ADMIN)",
      "queryParams": {
        "status": "UNREAD|READ (optional)",
        "type": "NotificationType (optional)",
        "limit": "1-50, default 20",
        "cursor": "CUID (optional)"
      },
      "response": "{ notifications: NotificationItem[], unreadCount: number, nextCursor: string | null }",
      "httpCodes": [200, 400, 401, 403]
    },
    "PATCH /api/notifications/[id]/read": {
      "auth": "JWT (propriétaire uniquement)",
      "body": "{}",
      "response": "{ data: NotificationItem }",
      "httpCodes": [200, 401, 403, 404]
    },
    "PATCH /api/notifications/read-all": {
      "auth": "JWT (HANDLER|MANAGER|ADMIN)",
      "body": "none",
      "response": "{ data: { updated: number } }",
      "httpCodes": [200, 401, 403]
    },
    "GET /api/notifications/unread-count": {
      "auth": "JWT (HANDLER|MANAGER|ADMIN)",
      "response": "{ unreadCount: number }",
      "cacheControl": "no-store",
      "httpCodes": [200, 401, 403]
    },
    "GET /api/notifications/check-sla": {
      "auth": "x-cron-secret header (pas de JWT)",
      "response": "{ data: SLACronResult }",
      "httpCodes": [200, 401, 500]
    },
    "GET /api/notifications/preferences": {
      "auth": "JWT (HANDLER|MANAGER|ADMIN)",
      "response": "{ data: NotificationPreferenceItem[] }",
      "httpCodes": [200, 401, 403]
    },
    "PATCH /api/notifications/preferences": {
      "auth": "JWT (HANDLER|MANAGER|ADMIN)",
      "body": {
        "type": "NotificationType",
        "inAppEnabled": "boolean (optional)",
        "emailEnabled": "boolean (optional)",
        "targetUserId": "string CUID (ADMIN uniquement)"
      },
      "response": "{ data: NotificationPreferenceItem }",
      "httpCodes": [200, 400, 401, 403]
    }
  },

  "businessRulesEncoded": {
    "NR-04": "triggerFraudAlert() vérifie existence FRAUD_ALERT non-archivée avant création",
    "NR-08": "checkSLABreaches() vérifie SLA_BREACH < 7j par [claimId, userId] avant création",
    "NR-09": "Tous les triggers vérifient assignedToID : si null → fallback vers tous MANAGER",
    "NR-15": "Toutes les routes filtrent sur userId = session.user.id",
    "NR-21": "sendNotificationEmail() est toujours appelée en fire-and-forget (void + .catch)",
    "NR-29": "Guard POLICYHOLDER explicite HTTP 403 dans chaque route /api/notifications/*",
    "NR-31": "createAuditLog(FRAUD_ALERT_SENT) toujours appelé dans triggerFraudAlert()"
  }
}
```

---

*Ce fichier est la source de vérité technique pour la feature `notifications-alertes`. Tout changement d'architecture doit être reflété ici avant implémentation.*

*Prochaine étape : `/backend notifications-alertes` → implémentation des services et routes API.*
