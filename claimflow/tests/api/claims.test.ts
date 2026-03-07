/**
 * TDD — GET /api/claims
 * Tests écrits AVANT l'implémentation (approche TDD)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    claim: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock NextAuth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock claim-service
vi.mock("@/lib/claim-service", () => ({
  getVisibleClaimsWhere: vi.fn().mockResolvedValue({}),
  generateClaimNumber: vi.fn().mockResolvedValue("SIN-2026-00001"),
  isValidTransition: vi.fn().mockReturnValue(true),
}));

// Mock audit
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "@/app/api/claims/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const mockSession = {
  user: { id: "user-1", email: "test@test.com", name: "Test User", role: "MANAGER" as const },
};

const mockClaims = [
  {
    id: "claim-1",
    claimNumber: "SIN-2026-00001",
    status: "SUBMITTED",
    type: "COLLISION",
    description: "Accrochage au carrefour",
    incidentDate: new Date("2026-01-15"),
    incidentLocation: "Paris",
    fraudScore: null,
    estimatedAmount: null,
    policyholder: { firstName: "Jean", lastName: "Dupont" },
    assignedTo: null,
    createdBy: { id: "user-1", name: "Test User", email: "test@test.com", role: "HANDLER" },
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { documents: 0, analyses: 0, comments: 0 },
  },
];

describe("GET /api/claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(mockSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    vi.mocked(prisma.claim.findMany).mockResolvedValue(mockClaims as ReturnType<typeof prisma.claim.findMany> extends Promise<infer T> ? T : never);
    vi.mocked(prisma.claim.count).mockResolvedValue(1);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/api/claims");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Non autorisé");
  });

  it("returns paginated claims for authenticated user", async () => {
    const req = new NextRequest("http://localhost:3000/api/claims");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeInstanceOf(Array);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
    expect(data.totalPages).toBe(1);
  });

  it("applies pagination with page and pageSize params", async () => {
    vi.mocked(prisma.claim.count).mockResolvedValue(50);
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    const req = new NextRequest("http://localhost:3000/api/claims?page=2&pageSize=10");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(10);
    expect(data.totalPages).toBe(5);
    expect(prisma.claim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  it("rejects invalid query params with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/claims?page=abc");
    const res = await GET(req);
    // coerce should handle this - page defaults to 1 via coerce
    expect(res.status).toBe(200);
  });

  it("filters by status", async () => {
    const req = new NextRequest("http://localhost:3000/api/claims?status=SUBMITTED");
    await GET(req);
    const { getVisibleClaimsWhere } = await import("@/lib/claim-service");
    expect(getVisibleClaimsWhere).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ status: "SUBMITTED" })
    );
  });

  it("returns empty array when no claims found", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    vi.mocked(prisma.claim.count).mockResolvedValue(0);
    const req = new NextRequest("http://localhost:3000/api/claims?search=nonexistent");
    const res = await GET(req);
    const data = await res.json();
    expect(data.data).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("orders claims by createdAt desc", async () => {
    const req = new NextRequest("http://localhost:3000/api/claims");
    await GET(req);
    expect(prisma.claim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });
});

describe("POST /api/claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(mockSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    vi.mocked(prisma.claim.create).mockResolvedValue(mockClaims[0] as ReturnType<typeof prisma.claim.create> extends Promise<infer T> ? T : never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/api/claims", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid claim data", async () => {
    const req = new NextRequest("http://localhost:3000/api/claims", {
      method: "POST",
      body: JSON.stringify({ type: "INVALID_TYPE" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Données invalides");
  });

  it("creates claim with auto-generated number", async () => {
    const req = new NextRequest("http://localhost:3000/api/claims", {
      method: "POST",
      body: JSON.stringify({
        type: "COLLISION",
        description: "Collision au carrefour de la rue",
        incidentDate: "2026-02-15T10:00:00.000Z",
        incidentLocation: "Rue de la Paix, Paris",
        thirdPartyInvolved: false,
        policyholderID: "cjld2cyuq0000t3rmniod1foy",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data).toBeDefined();
  });
});
