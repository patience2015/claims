import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/types";

interface CreateAuditLogParams {
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  claimId?: string;
  userId: string;
}

export async function createAuditLog({
  action,
  entityType,
  entityId,
  before,
  after,
  metadata,
  claimId,
  userId,
}: CreateAuditLogParams) {
  return prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      claimId: claimId ?? null,
      userId,
    },
  });
}

export async function getClaimAuditLogs(claimId: string) {
  return prisma.auditLog.findMany({
    where: { claimId },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
