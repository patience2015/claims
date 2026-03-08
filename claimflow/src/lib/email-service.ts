import nodemailer from "nodemailer";
import { prisma } from "./prisma";

export async function sendNotificationEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  if (process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? "noreply@claimflow.ai",
        to,
        subject,
        text: body,
      });
    } catch (err) {
      console.error("[sendNotificationEmail] SMTP error:", err);
    }
  } else {
    console.log(
      `[sendNotificationEmail] SMTP non configuré — email simulé\nTo: ${to}\nSubject: ${subject}\n${body}`
    );
  }
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Soumis",
  UNDER_REVIEW: "En instruction",
  INFO_REQUESTED: "Informations demandées",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  CLOSED: "Clôturé",
};

interface SendClaimStatusEmailParams {
  claimId: string;
  claimNumber: string;
  status: string;
  policyholderEmail: string;
  policyholderName: string;
}

export async function sendClaimStatusEmail({
  claimId,
  claimNumber,
  status,
  policyholderEmail,
  policyholderName,
}: SendClaimStatusEmailParams): Promise<void> {
  const statusLabel = STATUS_LABELS[status] ?? status;
  const subject = `[ClaimFlow] Votre dossier ${claimNumber} — ${statusLabel}`;
  const body = [
    `Bonjour ${policyholderName},`,
    ``,
    `Le statut de votre dossier ${claimNumber} a été mis à jour : ${statusLabel}.`,
    ``,
    `Connectez-vous sur votre espace assuré :`,
    `http://localhost:3000/portail/mes-sinistres/${claimId}`,
    ``,
    `Cordialement,`,
    `L'équipe ClaimFlow`,
  ].join("\n");

  // Sauvegarde en BDD dans tous les cas
  const notification = await prisma.emailNotification.create({
    data: { claimId, to: policyholderEmail, subject, body },
  });

  // Envoi SMTP uniquement si configuré
  if (process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? "noreply@claimflow.ai",
        to: policyholderEmail,
        subject,
        text: body,
      });

      await prisma.emailNotification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });
    } catch (err) {
      await prisma.emailNotification.update({
        where: { id: notification.id },
        data: { error: String(err) },
      });
    }
  }
}
