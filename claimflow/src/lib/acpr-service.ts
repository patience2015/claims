import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { AcprMetrics } from "@/types";

export async function computeAcprMetrics(periodStart: Date, periodEnd: Date): Promise<AcprMetrics> {
  const [opened, closed, newClaims, fraudClaims, allClaims, provisioned, paid, waiting] = await Promise.all([
    prisma.claim.count({ where: { status: { not: "CLOSED" }, createdAt: { lt: periodEnd } } }),
    prisma.claim.count({ where: { status: "CLOSED", updatedAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.claim.count({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.claim.count({ where: { createdAt: { gte: periodStart, lte: periodEnd }, fraudScore: { gte: 70 } } }),
    prisma.claim.findMany({ where: { createdAt: { gte: periodStart, lte: periodEnd } }, select: { createdAt: true, updatedAt: true, status: true, estimatedAmount: true, approvedAmount: true } }),
    prisma.claim.aggregate({ _sum: { estimatedAmount: true }, where: { status: { notIn: ["CLOSED", "REJECTED"] }, createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.claim.aggregate({ _sum: { approvedAmount: true }, where: { status: "CLOSED", updatedAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.claim.aggregate({ _sum: { estimatedAmount: true }, where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "APPROVED"] }, createdAt: { gte: periodStart, lte: periodEnd } } }),
  ]);

  const totalClaims = allClaims.length;
  const fraudRate = totalClaims > 0 ? (fraudClaims / totalClaims) * 100 : 0;

  const closedClaims = allClaims.filter((c) => c.status === "CLOSED");
  const avgProcessingDays = closedClaims.length > 0
    ? closedClaims.reduce((sum, c) => sum + (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) / closedClaims.length
    : 0;

  return {
    claimsOpened: opened,
    claimsClosed: closed,
    claimsNew: newClaims,
    totalProvisioned: provisioned._sum.estimatedAmount ?? 0,
    fraudRate: Math.round(fraudRate * 100) / 100,
    avgProcessingDays: Math.round(avgProcessingDays * 10) / 10,
    claimToPremiumRatio: 0, // calculé séparément si données primes disponibles
    indemnitesPaid: paid._sum.approvedAmount ?? 0,
    indemnitesWaiting: waiting._sum.estimatedAmount ?? 0,
  };
}

export function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function archiveAcprReport(reportId: string, buffer: Buffer, hash: string): Promise<string> {
  const storageDir = process.env.REPORTS_STORAGE_PATH ?? "./storage/reports";
  const absDir = path.resolve(process.cwd(), storageDir);
  if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

  const filePath = path.join(absDir, `${reportId}.pdf`);
  fs.writeFileSync(filePath, buffer);
  void hash; // stored on the record
  return filePath;
}

export async function generateAcprPdfBuffer(
  metrics: AcprMetrics,
  config: { headerTitle: string; headerSubtitle?: string | null; footerText?: string | null; sections: string[] },
  reportNumber: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Buffer> {
  const periodLabel = `${periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${config.headerTitle}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; }
  .header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
  h1 { color: #4f46e5; font-size: 24px; margin: 0; }
  .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
  .report-meta { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #4f46e5; color: white; padding: 10px 12px; text-align: left; font-size: 12px; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .section-title { font-size: 16px; font-weight: bold; color: #1e293b; margin: 24px 0 12px; border-left: 4px solid #4f46e5; padding-left: 12px; }
  .footer { border-top: 1px solid #e2e8f0; margin-top: 40px; padding-top: 16px; font-size: 10px; color: #94a3b8; }
</style>
</head>
<body>
<div class="header">
  <h1>${config.headerTitle}</h1>
  ${config.headerSubtitle ? `<div class="subtitle">${config.headerSubtitle}</div>` : ""}
</div>
<div class="report-meta">
  <strong>Rapport :</strong> ${reportNumber} &nbsp;|&nbsp;
  <strong>Période :</strong> ${periodLabel} &nbsp;|&nbsp;
  <strong>Généré le :</strong> ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}
</div>

<div class="section-title">1. Activité Sinistres</div>
<table>
  <tr><th>Indicateur</th><th>Valeur</th></tr>
  <tr><td>Sinistres ouverts (stock)</td><td>${metrics.claimsOpened}</td></tr>
  <tr><td>Sinistres clos sur la période</td><td>${metrics.claimsClosed}</td></tr>
  <tr><td>Nouveaux sinistres</td><td>${metrics.claimsNew}</td></tr>
  <tr><td>Délai moyen de traitement</td><td>${metrics.avgProcessingDays.toFixed(1)} jours</td></tr>
</table>

<div class="section-title">2. Provisions & Indemnités</div>
<table>
  <tr><th>Indicateur</th><th>Montant (€)</th></tr>
  <tr><td>Total provisionné</td><td>${metrics.totalProvisioned.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</td></tr>
  <tr><td>Indemnités payées</td><td>${metrics.indemnitesPaid.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</td></tr>
  <tr><td>Indemnités en attente</td><td>${metrics.indemnitesWaiting.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</td></tr>
</table>

<div class="section-title">3. Fraude & Conformité</div>
<table>
  <tr><th>Indicateur</th><th>Valeur</th></tr>
  <tr><td>Taux de fraude détectée</td><td>${metrics.fraudRate.toFixed(2)}%</td></tr>
  <tr><td>Ratio sinistres/primes</td><td>${metrics.claimToPremiumRatio.toFixed(3)}</td></tr>
</table>

${config.footerText ? `<div class="footer">${config.footerText}<br>` : '<div class="footer">'}
  Document généré automatiquement par ClaimFlow AI · Confidentiel ACPR · Période : ${periodStart.toLocaleDateString("fr-FR")} — ${periodEnd.toLocaleDateString("fr-FR")}
</div>
</body>
</html>`;

  return Buffer.from(html, "utf-8");
}
