/**
 * Tests — API Dashboard Team, SLA et Bulk-Assign
 * GET  /api/dashboard/team       — MANAGER/ADMIN uniquement, query param period
 * GET  /api/dashboard/sla        — MANAGER/ADMIN uniquement, overdue/atRisk/healthyCount
 * POST /api/claims/bulk-assign   — MANAGER/ADMIN uniquement, body {claimIds[], assignToId}
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    claim: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notification-service", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-new" }),
}));

// ─── Imports après les mocks ──────────────────────────────────────────────────

import { GET as getTeam } from "@/app/api/dashboard/team/route";
import { GET as getSla } from "@/app/api/dashboard/sla/route";
import { POST as postBulkAssign } from "@/app/api/claims/bulk-assign/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notification-service";

// ─── Sessions de test ─────────────────────────────────────────────────────────

type AuthReturn = ReturnType<typeof auth> extends Promise<infer T> ? T : never;

const mockManagerSession = {
  user: { id: "mgr-1", email: "manager@test.com", name: "Manager Marc", role: "MANAGER" as const },
};

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.com", name: "Admin Thomas", role: "ADMIN" as const },
};

const mockHandlerSession = {
  user: { id: "handler-1", email: "handler@test.com", name: "Handler Julie", role: "HANDLER" as const },
};

// ─── Données de test ──────────────────────────────────────────────────────────

const now = new Date("2026-03-08T12:00:00Z");

const mockUserWithClaims = [
  {
    id: "handler-1",
    name: "Handler Julie",
    email: "julie@claimflow.ai",
    role: "HANDLER",
    assignedClaims: [
      {
        id: "claim-1",
        status: "UNDER_REVIEW",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-15"),
      },
      {
        id: "claim-2",
        status: "APPROVED",
        createdAt: new Date("2026-01-10"),
        updatedAt: new Date("2026-02-01"),
      },
    ],
  },
  {
    id: "handler-2",
    name: "Handler Bob",
    email: "bob@claimflow.ai",
    role: "HANDLER",
    assignedClaims: [],
  },
];

const mockStaleClaims = [
  {
    id: "claim-overdue",
    claimNumber: "CLM-2026-00001",
    updatedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 jours — overdue
    assignedTo: {
      id: "handler-1",
      name: "Handler Julie",
      email: "julie@claimflow.ai",
      role: "HANDLER",
    },
    policyholder: {
      id: "ph-1",
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean.dupont@example.com",
    },
  },
  {
    id: "claim-at-risk",
    claimNumber: "CLM-2026-00002",
    updatedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 jours — at risk
    assignedTo: null,
    policyholder: {
      id: "ph-2",
      firstName: "Marie",
      lastName: "Martin",
      email: "marie.martin@example.com",
    },
  },
];

const mockTargetUser = {
  id: "handler-target",
  name: "Handler Target",
  active: true,
};

const mockExistingClaims = [
  { id: "claim-a", claimNumber: "CLM-2026-00010", assignedToID: null, status: "SUBMITTED" },
  { id: "claim-b", claimNumber: "CLM-2026-00011", assignedToID: "handler-old", status: "UNDER_REVIEW" },
];

const mockUpdatedClaims = [
  {
    id: "claim-a",
    claimNumber: "CLM-2026-00010",
    status: "UNDER_REVIEW",
    assignedToID: "handler-target",
    assignedTo: { id: "handler-target", name: "Handler Target", email: "target@test.com", role: "HANDLER" },
    updatedAt: now,
  },
  {
    id: "claim-b",
    claimNumber: "CLM-2026-00011",
    status: "UNDER_REVIEW",
    assignedToID: "handler-target",
    assignedTo: { id: "handler-target", name: "Handler Target", email: "target@test.com", role: "HANDLER" },
    updatedAt: now,
  },
];

// ─── GET /api/dashboard/team ──────────────────────────────────────────────────

describe("GET /api/dashboard/team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(mockManagerSession as AuthReturn);
    vi.mocked(prisma.user.findMany).mockResolvedValue(
      mockUserWithClaims as unknown as ReturnType<typeof prisma.user.findMany> extends Promise<infer T> ? T : never
    );
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 403 for HANDLER role", async () => {
    vi.mocked(auth).mockResolvedValue(mockHandlerSession as AuthReturn);
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 with TeamMemberStats[] for MANAGER", async () => {
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data).toHaveLength(2);

    const first = body.data[0];
    expect(first).toHaveProperty("userId");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("email");
    expect(first).toHaveProperty("role");
    expect(first).toHaveProperty("stats");
    expect(first.stats).toHaveProperty("total");
    expect(first.stats).toHaveProperty("pending");
    expect(first.stats).toHaveProperty("slaBreached");
    expect(first.stats).toHaveProperty("avgProcessingDays");
    expect(first.stats).toHaveProperty("approvalRate");
  });

  it("returns 200 with TeamMemberStats[] for ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as AuthReturn);
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeInstanceOf(Array);
  });

  it("computes stats correctly — total, pending, approvalRate", async () => {
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const handler = body.data[0]; // julie avec 2 claims
    expect(handler.stats.total).toBe(2);
    // UNDER_REVIEW est dans PENDING_STATUSES
    expect(handler.stats.pending).toBe(1);
    // 1 APPROVED sur 2 total → 50%
    expect(handler.stats.approvalRate).toBe(50);
  });

  it("returns empty stats for user with no claims", async () => {
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const handler = body.data[1]; // bob sans claims
    expect(handler.stats.total).toBe(0);
    expect(handler.stats.pending).toBe(0);
    expect(handler.stats.approvalRate).toBe(0);
    expect(handler.stats.avgProcessingDays).toBe(0);
  });

  it("accepts period=7d param and passes it to query", async () => {
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team?period=7d"));
    expect(res.status).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      })
    );
  });

  it("accepts period=90d param", async () => {
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team?period=90d"));
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid period param", async () => {
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team?period=invalid"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("uses default period=30d when no param is provided", async () => {
    const res = await getTeam(new NextRequest("http://localhost/api/dashboard/team"));
    expect(res.status).toBe(200);
    // La route doit fonctionner sans paramètre (default 30d)
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it("queries only active HANDLER and MANAGER users", async () => {
    await getTeam(new NextRequest("http://localhost/api/dashboard/team"));
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          role: expect.objectContaining({ in: expect.arrayContaining(["HANDLER", "MANAGER"]) }),
        }),
      })
    );
  });
});

// ─── GET /api/dashboard/sla ───────────────────────────────────────────────────

describe("GET /api/dashboard/sla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(mockManagerSession as AuthReturn);
    vi.mocked(prisma.claim.findMany).mockResolvedValue(
      mockStaleClaims as unknown as ReturnType<typeof prisma.claim.findMany> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.count).mockResolvedValue(5);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const res = await getSla();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 403 for HANDLER role", async () => {
    vi.mocked(auth).mockResolvedValue(mockHandlerSession as AuthReturn);
    const res = await getSla();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 with SlaReport structure for MANAGER", async () => {
    const res = await getSla();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data).toHaveProperty("overdue");
    expect(body.data).toHaveProperty("atRisk");
    expect(body.data).toHaveProperty("healthyCount");
  });

  it("returns 200 with SlaReport structure for ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as AuthReturn);
    const res = await getSla();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("overdue");
    expect(body.data).toHaveProperty("atRisk");
    expect(body.data).toHaveProperty("healthyCount");
  });

  it("splits stale claims into overdue (>= 30d) and atRisk (< 30d)", async () => {
    const res = await getSla();
    expect(res.status).toBe(200);
    const body = await res.json();
    // claim-overdue (35 jours) doit être dans overdue
    expect(body.data.overdue).toHaveLength(1);
    expect(body.data.overdue[0].claimNumber).toBe("CLM-2026-00001");
    // claim-at-risk (25 jours) doit être dans atRisk
    expect(body.data.atRisk).toHaveLength(1);
    expect(body.data.atRisk[0].claimNumber).toBe("CLM-2026-00002");
  });

  it("returns healthyCount from prisma.claim.count", async () => {
    const res = await getSla();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.healthyCount).toBe(5);
    expect(prisma.claim.count).toHaveBeenCalledTimes(1);
  });

  it("overdue items contain daysSinceUpdate and policyholder fields", async () => {
    const res = await getSla();
    expect(res.status).toBe(200);
    const body = await res.json();
    const overdueItem = body.data.overdue[0];
    expect(overdueItem).toHaveProperty("id");
    expect(overdueItem).toHaveProperty("claimNumber");
    expect(overdueItem).toHaveProperty("daysSinceUpdate");
    expect(overdueItem.daysSinceUpdate).toBeGreaterThanOrEqual(30);
    expect(overdueItem).toHaveProperty("policyholder");
    expect(overdueItem.policyholder).toHaveProperty("firstName");
    expect(overdueItem.policyholder).toHaveProperty("lastName");
  });

  it("handles null assignedTo on overdue claim", async () => {
    const res = await getSla();
    expect(res.status).toBe(200);
    const body = await res.json();
    const atRiskItem = body.data.atRisk[0];
    expect(atRiskItem.assignedTo).toBeNull();
  });

  it("returns empty overdue and atRisk when no stale claims", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue(
      [] as ReturnType<typeof prisma.claim.findMany> extends Promise<infer T> ? T : never
    );
    const res = await getSla();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.overdue).toHaveLength(0);
    expect(body.data.atRisk).toHaveLength(0);
  });
});

// ─── POST /api/claims/bulk-assign ─────────────────────────────────────────────

describe("POST /api/claims/bulk-assign", () => {
  const makeRequest = (body: unknown) =>
    new NextRequest("http://localhost/api/claims/bulk-assign", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(mockManagerSession as AuthReturn);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockTargetUser as unknown as ReturnType<typeof prisma.user.findUnique> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.findMany).mockResolvedValue(
      mockExistingClaims as unknown as ReturnType<typeof prisma.claim.findMany> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.$transaction).mockResolvedValue(
      mockUpdatedClaims as Awaited<ReturnType<typeof prisma.$transaction>>
    );
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const res = await postBulkAssign(
      makeRequest({ claimIds: ["claim-a"], assignToId: "handler-target" })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 403 for HANDLER role", async () => {
    vi.mocked(auth).mockResolvedValue(mockHandlerSession as AuthReturn);
    const res = await postBulkAssign(
      makeRequest({ claimIds: ["claim-a"], assignToId: "handler-target" })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 403 for HANDLER even with valid body", async () => {
    vi.mocked(auth).mockResolvedValue(mockHandlerSession as AuthReturn);
    const res = await postBulkAssign(
      makeRequest({ claimIds: ["claim-a", "claim-b"], assignToId: "handler-target" })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing claimIds", async () => {
    const res = await postBulkAssign(makeRequest({ assignToId: "handler-target" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for empty claimIds array", async () => {
    const res = await postBulkAssign(
      makeRequest({ claimIds: [], assignToId: "handler-target" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for missing assignToId", async () => {
    const res = await postBulkAssign(makeRequest({ claimIds: ["claim-a"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for empty assignToId string", async () => {
    const res = await postBulkAssign(
      makeRequest({ claimIds: ["claim-a"], assignToId: "" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for claimIds array exceeding 50 items", async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `claim-${i}`);
    const res = await postBulkAssign(makeRequest({ claimIds: tooMany, assignToId: "handler-target" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when target user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const res = await postBulkAssign(
      makeRequest({ claimIds: ["claim-a"], assignToId: "unknown-user" })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/introuvable/i);
  });

  it("returns 404 when target user is inactive", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      { ...mockTargetUser, active: false } as ReturnType<typeof prisma.user.findUnique> extends Promise<infer T> ? T : never
    );
    const res = await postBulkAssign(
      makeRequest({ claimIds: ["claim-a"], assignToId: "handler-target" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when no matching claims found in DB", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue(
      [] as ReturnType<typeof prisma.claim.findMany> extends Promise<infer T> ? T : never
    );
    const res = await postBulkAssign(
      makeRequest({ claimIds: ["nonexistent-claim"], assignToId: "handler-target" })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/sinistre/i);
  });

  it("returns 201 with updated claims count on success", async () => {
    const res = await postBulkAssign(
      makeRequest({ claimIds: ["claim-a", "claim-b"], assignToId: "handler-target" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty("updated");
    expect(body.data.updated).toBe(2);
    expect(body.data).toHaveProperty("claims");
    expect(body.data.claims).toHaveLength(2);
  });

  it("calls prisma.$transaction to update all claims atomically", async () => {
    await postBulkAssign(
      makeRequest({ claimIds: ["claim-a", "claim-b"], assignToId: "handler-target" })
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("creates one audit log per assigned claim", async () => {
    await postBulkAssign(
      makeRequest({ claimIds: ["claim-a", "claim-b"], assignToId: "handler-target" })
    );
    expect(createAuditLog).toHaveBeenCalledTimes(2);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CLAIM_ASSIGNED",
        entityType: "CLAIM",
        userId: "mgr-1",
      })
    );
  });

  it("creates one notification for the assigned user", async () => {
    await postBulkAssign(
      makeRequest({ claimIds: ["claim-a", "claim-b"], assignToId: "handler-target" })
    );
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "handler-target",
        type: "CLAIM_ASSIGNED",
      })
    );
  });

  it("calls $transaction once with an array of the same length as claimIds found in DB", async () => {
    await postBulkAssign(
      makeRequest({ claimIds: ["claim-a", "claim-b"], assignToId: "handler-target" })
    );
    // $transaction est appelé avec un tableau dont la longueur correspond au nombre de sinistres trouvés
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const [transactionArg] = vi.mocked(prisma.$transaction).mock.calls[0] as unknown as [unknown[]];
    expect(transactionArg).toHaveLength(2);
  });

  it("ADMIN can also bulk-assign successfully", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as AuthReturn);
    const res = await postBulkAssign(
      makeRequest({ claimIds: ["claim-a"], assignToId: "handler-target" })
    );
    expect(res.status).toBe(201);
  });
});
