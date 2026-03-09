import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/email-service";
import type { RiskLevel } from "@/types";

const LEVEL_ORDER: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };
const THROTTLE_HOURS = 24;

function buildAlertEmail(name: string, level: RiskLevel, score: number): { subject: string; body: string } {
  const levelLabels: Record<RiskLevel, string> = { LOW: "Faible", MODERATE: "Modéré", HIGH: "Élevé", CRITICAL: "Critique" };
  return {
    subject: `ClaimFlow — Alerte préventive : niveau de risque ${levelLabels[level]}`,
    body: [
      `Bonjour ${name},`,
      ``,
      `Nous avons détecté un changement de votre niveau de risque assuré.`,
      ``,
      `Score actuel : ${score}/100 — Niveau ${levelLabels[level]}`,
      ``,
      `Nous vous recommandons de vérifier l'état de votre véhicule et de redoubler de vigilance dans votre zone.`,
      ``,
      `Cordialement,`,
      `L'équipe ClaimFlow`,
    ].join("\n"),
  };
}

export async function checkAndSendRiskAlert(params: {
  policyholderId: string;
  previousLevel: RiskLevel | null;
  newLevel: RiskLevel;
  scoreGlobal: number;
  policyholderEmail: string;
  policyholderName: string;
  contractStatus: string;
}): Promise<void> {
  const { policyholderId, previousLevel, newLevel, scoreGlobal, policyholderEmail, policyholderName, contractStatus } = params;

  if (contractStatus === "EXPIRED") return;

  const prevOrder = previousLevel !== null ? LEVEL_ORDER[previousLevel] : -1;
  const newOrder = LEVEL_ORDER[newLevel];
  if (newOrder <= prevOrder && newLevel !== "CRITICAL") return;

  const cutoff = new Date(Date.now() - THROTTLE_HOURS * 60 * 60 * 1000);
  const recentAlert = await prisma.riskAlertLog.findFirst({
    where: { policyholderId, createdAt: { gte: cutoff } },
  });
  if (recentAlert) return;

  const { subject, body } = buildAlertEmail(policyholderName, newLevel, scoreGlobal);
  await sendNotificationEmail(policyholderEmail, subject, body);

  await prisma.riskAlertLog.create({
    data: {
      policyholderId,
      alertType: newLevel === "CRITICAL" ? "CRITICAL_ALERT" : "LEVEL_CHANGE",
      previousLevel: previousLevel ?? "NONE",
      newLevel,
      emailSentAt: new Date(),
    },
  });
}
