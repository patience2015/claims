/**
 * Tests — src/lib/claim-service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    claim: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notification-service", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

import {
  generateClaimNumber,
  isValidTransition,
  checkAutoApproval,
  checkFraudEscalation,
  getVisibleClaimsWhere,
} from "@/lib/claim-service";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notification-service";

describe("generateClaimNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates CLM-YYYY-00001 when no existing claim", async () => {
    vi.mocked(prisma.claim.findFirst).mockResolvedValue(null);
    const year = new Date().getFullYear();
    const result = await generateClaimNumber();
    expect(result).toBe(`CLM-${year}-00001`);
  });

  it("increments sequence from last claim", async () => {
    const year = new Date().getFullYear();
    vi.mocked(prisma.claim.findFirst).mockResolvedValue({
      claimNumber: `CLM-${year}-00005`,
    } as ReturnType<typeof prisma.claim.findFirst> extends Promise<infer T> ? T : never);
    const result = await generateClaimNumber();
    expect(result).toBe(`CLM-${year}-00006`);
  });

  it("pads sequence to 5 digits", async () => {
    const year = new Date().getFullYear();
    vi.mocked(prisma.claim.findFirst).mockResolvedValue({
      claimNumber: `CLM-${year}-00099`,
    } as ReturnType<typeof prisma.claim.findFirst> extends Promise<infer T> ? T : never);
    const result = await generateClaimNumber();
    expect(result).toBe(`CLM-${year}-00100`);
  });
});

describe("isValidTransition", () => {
  it("SUBMITTED → UNDER_REVIEW is valid", () => {
    expect(isValidTransition("SUBMITTED", "UNDER_REVIEW")).toBe(true);
  });

  it("SUBMITTED → INFO_REQUESTED is invalid (goes through UNDER_REVIEW first)", () => {
    expect(isValidTransition("SUBMITTED", "INFO_REQUESTED")).toBe(false);
  });

  it("UNDER_REVIEW → APPROVED is valid", () => {
    expect(isValidTransition("UNDER_REVIEW", "APPROVED")).toBe(true);
  });

  it("UNDER_REVIEW → REJECTED is valid", () => {
    expect(isValidTransition("UNDER_REVIEW", "REJECTED")).toBe(true);
  });

  it("APPROVED → CLOSED is valid", () => {
    expect(isValidTransition("APPROVED", "CLOSED")).toBe(true);
  });

  it("CLOSED → SUBMITTED is invalid", () => {
    expect(isValidTransition("CLOSED", "SUBMITTED")).toBe(false);
  });

  it("REJECTED → APPROVED is invalid", () => {
    expect(isValidTransition("REJECTED", "APPROVED")).toBe(false);
  });

  it("SUBMITTED → APPROVED is invalid", () => {
    expect(isValidTransition("SUBMITTED", "APPROVED")).toBe(false);
  });
});

describe("checkAutoApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.claim.update).mockResolvedValue({
      id: "claim-1",
      status: "APPROVED",
    } as ReturnType<typeof prisma.claim.update> extends Promise<infer T> ? T : never);
  });

  it("auto-approves when amount < 2000 and fraudScore < 30", async () => {
    const result = await checkAutoApproval("claim-1", 1500, 20, "user-1");
    expect(result).toBe(true);
    expect(prisma.claim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED", approvedAmount: 1500 }),
      })
    );
    expect(createAuditLog).toHaveBeenCalled();
  });

  it("does not auto-approve when amount >= 2000", async () => {
    const result = await checkAutoApproval("claim-1", 2000, 20, "user-1");
    expect(result).toBe(false);
    expect(prisma.claim.update).not.toHaveBeenCalled();
  });

  it("does not auto-approve when fraudScore >= 30", async () => {
    const result = await checkAutoApproval("claim-1", 1000, 30, "user-1");
    expect(result).toBe(false);
    expect(prisma.claim.update).not.toHaveBeenCalled();
  });

  it("does not auto-approve when both thresholds exceeded", async () => {
    const result = await checkAutoApproval("claim-1", 5000, 80, "user-1");
    expect(result).toBe(false);
  });
});

describe("checkFraudEscalation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "manager-1",
      name: "Manager Test",
      role: "MANAGER",
      active: true,
    } as ReturnType<typeof prisma.user.findFirst> extends Promise<infer T> ? T : never);
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      id: "claim-1",
      claimNumber: "CLM-2026-00001",
    } as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never);
    vi.mocked(prisma.claim.update).mockResolvedValue({
      id: "claim-1",
    } as ReturnType<typeof prisma.claim.update> extends Promise<infer T> ? T : never);
  });

  it("escalates when fraudScore > 70 and manager exists", async () => {
    const result = await checkFraudEscalation("claim-1", 75, "user-1");
    expect(result).toBe(true);
    expect(prisma.claim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedToID: "manager-1", status: "UNDER_REVIEW" }),
      })
    );
    expect(createAuditLog).toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "manager-1",
        type: "FRAUD_ALERT",
        claimId: "claim-1",
      })
    );
  });

  it("does not escalate when fraudScore <= 70", async () => {
    const result = await checkFraudEscalation("claim-1", 70, "user-1");
    expect(result).toBe(false);
    expect(prisma.claim.update).not.toHaveBeenCalled();
  });

  it("does not escalate when no manager found", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const result = await checkFraudEscalation("claim-1", 85, "user-1");
    expect(result).toBe(false);
    expect(prisma.claim.update).not.toHaveBeenCalled();
  });

  it("handles missing claimNumber gracefully", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(null);
    const result = await checkFraudEscalation("claim-1", 75, "user-1");
    expect(result).toBe(true);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("claim-1") })
    );
  });
});

describe("getVisibleClaimsWhere", () => {
  it("returns empty where for MANAGER", async () => {
    const result = await getVisibleClaimsWhere("MANAGER", "user-1", {});
    expect(result).toEqual({});
  });

  it("adds OR filter for HANDLER role", async () => {
    const result = await getVisibleClaimsWhere("HANDLER", "user-1", {});
    expect(result).toHaveProperty("OR");
    const or = result.OR as Array<Record<string, unknown>>;
    expect(or).toEqual(
      expect.arrayContaining([
        { assignedToID: "user-1" },
        { createdByID: "user-1" },
      ])
    );
  });

  it("adds status filter", async () => {
    const result = await getVisibleClaimsWhere("MANAGER", "user-1", { status: "SUBMITTED" });
    expect(result.status).toBe("SUBMITTED");
  });

  it("adds type filter", async () => {
    const result = await getVisibleClaimsWhere("MANAGER", "user-1", { type: "COLLISION" });
    expect(result.type).toBe("COLLISION");
  });

  it("adds assignedToId filter", async () => {
    const result = await getVisibleClaimsWhere("MANAGER", "user-1", { assignedToId: "user-2" });
    expect(result.assignedToID).toBe("user-2");
  });

  it("adds date range filter with both dates", async () => {
    const result = await getVisibleClaimsWhere("MANAGER", "user-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-03-01",
    });
    const incidentDate = result.incidentDate as Record<string, unknown>;
    expect(incidentDate).toHaveProperty("gte");
    expect(incidentDate).toHaveProperty("lte");
  });

  it("adds date filter with only dateFrom", async () => {
    const result = await getVisibleClaimsWhere("MANAGER", "user-1", { dateFrom: "2026-01-01" });
    const incidentDate = result.incidentDate as Record<string, unknown>;
    expect(incidentDate).toHaveProperty("gte");
    expect(incidentDate).not.toHaveProperty("lte");
  });

  it("adds search filter as OR for MANAGER", async () => {
    const result = await getVisibleClaimsWhere("MANAGER", "user-1", { search: "dupont" });
    expect(result).toHaveProperty("OR");
  });

  it("adds search filter with AND for HANDLER (both role and search OR)", async () => {
    const result = await getVisibleClaimsWhere("HANDLER", "user-1", { search: "dupont" });
    expect(result).toHaveProperty("AND");
    expect(result).not.toHaveProperty("OR");
  });
});
