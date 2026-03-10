import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { AcprMetrics } from "@/types";

export { generateAcprPdfBuffer } from "@/lib/acpr-pdf";

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

