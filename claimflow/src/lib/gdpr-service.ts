import { prisma } from "@/lib/prisma";
import { createId } from "@paralleldrive/cuid2";
import type { GdprExportPayload } from "@/types";
import type { NextRequest } from "next/server";

export async function anonymizePolicyholder(policyholderId: string, requestId: string, executedById: string): Promise<void> {
  const anonId = createId();
  await prisma.$transaction([
    prisma.policyholder.update({
      where: { id: policyholderId },
      data: {
        firstName: "ANONYMIZED",
        lastName: "ANONYMIZED",
        email: `anon-${anonId}@deleted.local`,
        phone: "0000000000",
        address: "ANONYMIZED",
        vehiclePlate: "XX-000-XX",
        latitude: null,
        longitude: null,
      },
    }),
    prisma.gdprErasureRequest.update({
      where: { id: requestId },
      data: { status: "EXECUTED", executedAt: new Date(), executedById },
    }),
  ]);
}

export async function exportPolicyholderData(policyholderId: string): Promise<GdprExportPayload> {
  const [policyholder, claims, auditLogs] = await Promise.all([
    prisma.policyholder.findUnique({ where: { id: policyholderId } }),
    prisma.claim.findMany({
      where: { policyholderID: policyholderId },
      select: { id: true, claimNumber: true, type: true, status: true, createdAt: true, estimatedAmount: true },
    }),
    prisma.auditLog.findMany({
      where: { entityId: policyholderId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { action: true, createdAt: true, userId: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    policyholder: (policyholder as Record<string, unknown>) ?? {},
    claims: claims as Record<string, unknown>[],
    auditTrail: auditLogs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };
}

export async function purgeStaleClaims(cutoffDate: Date, dryRun: boolean): Promise<number> {
  const stale = await prisma.claim.findMany({
    where: { status: "CLOSED", updatedAt: { lt: cutoffDate } },
    select: { id: true },
  });
  if (!dryRun && stale.length > 0) {
    await prisma.claim.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
  }
  return stale.length;
}

export async function purgeStaleLogs(cutoffDate: Date, dryRun: boolean): Promise<number> {
  const count = await prisma.auditLog.count({ where: { createdAt: { lt: cutoffDate } } });
  if (!dryRun && count > 0) {
    await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoffDate } } });
  }
  return count;
}

export async function purgeWeatherCache(dryRun: boolean): Promise<number> {
  const now = new Date();
  const count = await prisma.weatherCache.count({ where: { expiresAt: { lt: now } } });
  if (!dryRun && count > 0) {
    await prisma.weatherCache.deleteMany({ where: { expiresAt: { lt: now } } });
  }
  return count;
}

export async function logDataAccess(
  accessorId: string,
  entityType: string,
  entityId: string,
  action: string,
  req?: NextRequest
): Promise<void> {
  await prisma.gdprDataAccessLog.create({
    data: {
      accessorId,
      entityType,
      entityId,
      action,
      ipAddress: req?.headers.get("x-forwarded-for") ?? req?.headers.get("x-real-ip") ?? null,
      userAgent: req?.headers.get("user-agent") ?? null,
    },
  });
}
