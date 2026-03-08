/**
 * Tests — GET /api/dashboard/stats, /api/dashboard/charts, /api/dashboard/recent
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    claim: {
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { GET as getStats } from "@/app/api/dashboard/stats/route";
import { GET as getCharts } from "@/app/api/dashboard/charts/route";
import { GET as getRecent } from "@/app/api/dashboard/recent/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const mockManagerSession = {
  user: { id: "user-1", email: "manager@test.com", name: "Manager", role: "MANAGER" as const },
};

const mockHandlerSession = {
  user: { id: "handler-1", email: "handler@test.com", name: "Handler", role: "HANDLER" as const },
};

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────

describe("GET /api/dashboard/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.count).mockResolvedValue(10);
    vi.mocked(prisma.claim.groupBy).mockResolvedValue([
      { status: "SUBMITTED", _count: { id: 3 } },
      { status: "APPROVED", _count: { id: 7 } },
    ] as ReturnType<typeof prisma.claim.groupBy> extends Promise<infer T> ? T : never);
    vi.mocked(prisma.claim.aggregate).mockResolvedValue({
      _sum: { estimatedAmount: 50000 },
    } as ReturnType<typeof prisma.claim.aggregate> extends Promise<infer T> ? T : never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/dashboard/stats");
    const res = await getStats(req);
    expect(res.status).toBe(401);
  });

  it("returns stats for manager", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/stats");
    const res = await getStats(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data.data.totalClaims).toBe(10);
    expect(data.data.totalEstimatedAmount).toBe(50000);
  });

  it("returns fraudRate as 0 when no claims", async () => {
    vi.mocked(prisma.claim.count).mockResolvedValue(0);
    const req = new NextRequest("http://localhost/api/dashboard/stats");
    const res = await getStats(req);
    const data = await res.json();
    expect(data.data.fraudRate).toBe(0);
  });

  it("calculates pendingClaims from status map", async () => {
    vi.mocked(prisma.claim.groupBy).mockResolvedValue([
      { status: "SUBMITTED", _count: { id: 2 } },
      { status: "UNDER_REVIEW", _count: { id: 3 } },
      { status: "INFO_REQUESTED", _count: { id: 1 } },
      { status: "APPROVED", _count: { id: 4 } },
    ] as ReturnType<typeof prisma.claim.groupBy> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/dashboard/stats");
    const res = await getStats(req);
    const data = await res.json();
    expect(data.data.pendingClaims).toBe(6); // 2 + 3 + 1
  });

  it("accepts 7d period", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/stats?period=7d");
    const res = await getStats(req);
    expect(res.status).toBe(200);
  });

  it("accepts 90d period", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/stats?period=90d");
    const res = await getStats(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid period", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/stats?period=invalid");
    const res = await getStats(req);
    expect(res.status).toBe(400);
  });

  it("applies HANDLER role visibility filter", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const req = new NextRequest("http://localhost/api/dashboard/stats");
    await getStats(req);
    expect(prisma.claim.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.arrayContaining([{ assignedToID: "handler-1" }]) }),
      })
    );
  });

  it("handles null estimatedAmount sum", async () => {
    vi.mocked(prisma.claim.aggregate).mockResolvedValue({
      _sum: { estimatedAmount: null },
    } as ReturnType<typeof prisma.claim.aggregate> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/dashboard/stats");
    const res = await getStats(req);
    const data = await res.json();
    expect(data.data.totalEstimatedAmount).toBe(0);
  });
});

// ─── GET /api/dashboard/charts ────────────────────────────────────────────────

describe("GET /api/dashboard/charts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      { createdAt: new Date("2026-03-01"), type: "COLLISION", estimatedAmount: 5000, status: "APPROVED" },
      { createdAt: new Date("2026-03-01"), type: "THEFT", estimatedAmount: 3000, status: "SUBMITTED" },
      { createdAt: new Date("2026-03-02"), type: "COLLISION", estimatedAmount: 2000, status: "CLOSED" },
    ] as ReturnType<typeof prisma.claim.findMany> extends Promise<infer T> ? T : never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/dashboard/charts");
    const res = await getCharts(req);
    expect(res.status).toBe(401);
  });

  it("returns chart data with timeline and type distribution", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/charts");
    const res = await getCharts(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.timeline).toBeInstanceOf(Array);
    expect(data.data.typeDistribution).toBeInstanceOf(Array);
  });

  it("groups claims by date for timeline", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/charts");
    const res = await getCharts(req);
    const data = await res.json();
    // 2 dates: 2026-03-01 (2 claims) and 2026-03-02 (1 claim)
    expect(data.data.timeline).toHaveLength(2);
    const march1 = data.data.timeline.find((t: { date: string }) => t.date === "2026-03-01");
    expect(march1?.count).toBe(2);
  });

  it("groups claims by type for distribution", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/charts");
    const res = await getCharts(req);
    const data = await res.json();
    // 2 COLLISION, 1 THEFT
    const collision = data.data.typeDistribution.find((t: { type: string }) => t.type === "COLLISION");
    expect(collision?.count).toBe(2);
  });

  it("accepts 7d period param", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/charts?period=7d");
    const res = await getCharts(req);
    expect(res.status).toBe(200);
  });

  it("handles empty claims list", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/dashboard/charts");
    const res = await getCharts(req);
    const data = await res.json();
    expect(data.data.timeline).toHaveLength(0);
    expect(data.data.typeDistribution).toHaveLength(0);
  });
});

// ─── GET /api/dashboard/recent ────────────────────────────────────────────────

describe("GET /api/dashboard/recent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/dashboard/recent");
    const res = await getRecent(req);
    expect(res.status).toBe(401);
  });

  it("returns recent claims and audit logs", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/recent");
    const res = await getRecent(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveProperty("recentClaims");
    expect(data.data).toHaveProperty("recentAuditLogs");
  });

  it("applies HANDLER visibility filter", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const req = new NextRequest("http://localhost/api/dashboard/recent");
    await getRecent(req);
    expect(prisma.claim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.arrayContaining([{ assignedToID: "handler-1" }]) }),
      })
    );
  });
});
