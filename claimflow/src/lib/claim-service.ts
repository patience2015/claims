import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { VALID_TRANSITIONS, ClaimStatus } from "@/types";

// Generate claim number: CLM-YYYY-NNNNN
export async function generateClaimNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CLM-${year}-`;

  // Find the highest existing number for this year
  const lastClaim = await prisma.claim.findFirst({
    where: { claimNumber: { startsWith: prefix } },
    orderBy: { claimNumber: "desc" },
  });

  let nextSeq = 1;
  if (lastClaim) {
    const currentSeq = parseInt(lastClaim.claimNumber.split("-")[2], 10);
    nextSeq = currentSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}

// Validate status transition
export function isValidTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Auto-approval rule: amount < 2000€ AND fraud score < 30
export async function checkAutoApproval(
  claimId: string,
  estimatedAmount: number,
  fraudScore: number,
  userId: string
): Promise<boolean> {
  const AUTO_APPROVAL_AMOUNT = 2000;
  const AUTO_APPROVAL_FRAUD_THRESHOLD = 30;

  if (estimatedAmount < AUTO_APPROVAL_AMOUNT && fraudScore < AUTO_APPROVAL_FRAUD_THRESHOLD) {
    await prisma.claim.update({
      where: { id: claimId },
      data: {
        status: "APPROVED",
        approvedAmount: estimatedAmount,
      },
    });

    await createAuditLog({
      action: "STATUS_CHANGED",
      entityType: "CLAIM",
      entityId: claimId,
      before: { status: "UNDER_REVIEW" },
      after: { status: "APPROVED", approvedAmount: estimatedAmount },
      metadata: { reason: "Auto-approbation: montant < 2000€ et score fraude < 30", estimatedAmount, fraudScore },
      claimId,
      userId,
    });

    return true;
  }
  return false;
}

// Fraud escalation rule: score > 70 → assign to manager
export async function checkFraudEscalation(
  claimId: string,
  fraudScore: number,
  userId: string
): Promise<boolean> {
  const ESCALATION_THRESHOLD = 70;

  if (fraudScore > ESCALATION_THRESHOLD) {
    // Find a manager to assign to
    const manager = await prisma.user.findFirst({
      where: { role: "MANAGER", active: true },
    });

    if (manager) {
      await prisma.claim.update({
        where: { id: claimId },
        data: {
          assignedToID: manager.id,
          status: "UNDER_REVIEW",
        },
      });

      await createAuditLog({
        action: "CLAIM_ASSIGNED",
        entityType: "CLAIM",
        entityId: claimId,
        after: { assignedToId: manager.id, reason: `Score fraude ${fraudScore} > ${ESCALATION_THRESHOLD}` },
        metadata: { fraudScore, escalationThreshold: ESCALATION_THRESHOLD, assignedTo: manager.name },
        claimId,
        userId,
      });

      return true;
    }
  }
  return false;
}

// Get claims visible to user based on their role
export async function getVisibleClaimsWhere(
  userRole: string,
  userId: string,
  filters: {
    status?: string;
    type?: string;
    search?: string;
    assignedToId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const where: Record<string, unknown> = {};

  // Role-based filtering
  if (userRole === "HANDLER") {
    where.OR = [
      { assignedToID: userId },
      { createdByID: userId },
    ];
  }

  // Status filter
  if (filters.status) {
    where.status = filters.status;
  }

  // Type filter
  if (filters.type) {
    where.type = filters.type;
  }

  // Search filter
  if (filters.search) {
    const searchOr = [
      { claimNumber: { contains: filters.search } },
      { description: { contains: filters.search } },
      { incidentLocation: { contains: filters.search } },
      {
        policyholder: {
          OR: [
            { firstName: { contains: filters.search } },
            { lastName: { contains: filters.search } },
            { policyNumber: { contains: filters.search } },
          ],
        },
      },
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  // Assigned to filter
  if (filters.assignedToId) {
    where.assignedToID = filters.assignedToId;
  }

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    where.incidentDate = {};
    if (filters.dateFrom) {
      (where.incidentDate as Record<string, unknown>).gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      (where.incidentDate as Record<string, unknown>).lte = new Date(filters.dateTo);
    }
  }

  return where;
}
