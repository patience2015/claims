import { prisma } from "./prisma";

export type NotificationType =
  | "CLAIM_ASSIGNED"
  | "STATUS_CHANGED"
  | "FRAUD_ALERT"
  | "SLA_BREACH"
  | "DOCUMENT_UPLOADED_BY_POLICYHOLDER"
  | "NETWORK_FRAUD_ALERT"
  | "NETWORK_ESCALATED";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  claimId?: string;
}

// Crée une notification in-app (vérifie préférences)
export async function createNotification(input: CreateNotificationInput) {
  // Vérifie préférence inApp
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId: input.userId, type: input.type } },
  });
  if (pref && !pref.inAppEnabled) return null;

  // Déduplication FRAUD_ALERT et SLA_BREACH
  if (input.type === "FRAUD_ALERT" && input.claimId) {
    const existing = await prisma.notification.findFirst({
      where: { type: "FRAUD_ALERT", claimId: input.claimId, read: false },
    });
    if (existing) return existing;
  }
  if (input.type === "SLA_BREACH" && input.claimId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const existing = await prisma.notification.findFirst({
      where: {
        type: "SLA_BREACH",
        claimId: input.claimId,
        userId: input.userId,
        createdAt: { gte: sevenDaysAgo },
      },
    });
    if (existing) return existing;
  }

  return prisma.notification.create({ data: input });
}

// Vérifie les sinistres en UNDER_REVIEW depuis > 30j et crée des notifications MANAGER
export async function checkSLABreaches(): Promise<{ checked: number; created: number }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Sinistres en UNDER_REVIEW depuis > 30j sans décision
  const overdueClams = await prisma.claim.findMany({
    where: {
      status: "UNDER_REVIEW",
      updatedAt: { lte: thirtyDaysAgo },
    },
    select: { id: true, claimNumber: true, updatedAt: true },
  });

  // Managers actifs
  const managers = await prisma.user.findMany({
    where: { role: "MANAGER", active: true },
    select: { id: true },
  });

  let created = 0;
  for (const claim of overdueClams) {
    for (const manager of managers) {
      const notif = await createNotification({
        userId: manager.id,
        type: "SLA_BREACH",
        title: `SLA dépassé — ${claim.claimNumber}`,
        body: `Le sinistre ${claim.claimNumber} est en instruction depuis plus de 30 jours sans décision.`,
        claimId: claim.id,
      });
      if (notif && !("read" in notif && notif.createdAt < new Date(Date.now() - 1000))) {
        // Nouvelle notification créée (pas dédupliquée)
        const isNew = notif.createdAt > new Date(Date.now() - 5000);
        if (isNew) created++;
      }
    }
  }

  return { checked: overdueClams.length, created };
}
