/**
 * Tests — GET/PATCH/DELETE /api/claims/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    claim: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notification-service", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

import { GET, PATCH, DELETE } from "@/app/api/claims/[id]/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type AuthReturn = ReturnType<typeof auth> extends Promise<infer T> ? T : never;
type ClaimReturn = ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never;
type ClaimUpdateReturn = ReturnType<typeof prisma.claim.update> extends Promise<infer T> ? T : never;
type ClaimDeleteReturn = ReturnType<typeof prisma.claim.delete> extends Promise<infer T> ? T : never;

const mockManagerSession = {
  user: { id: "user-1", email: "manager@test.com", name: "Manager", role: "MANAGER" as const },
};

const mockHandlerSession = {
  user: { id: "handler-1", email: "handler@test.com", name: "Handler", role: "HANDLER" as const },
};

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.com", name: "Admin", role: "ADMIN" as const },
};

const mockClaim = {
  id: "claim-1",
  claimNumber: "CLM-2026-00001",
  status: "SUBMITTED",
  type: "COLLISION",
  description: "Test description",
  incidentDate: new Date("2026-01-15"),
  incidentLocation: "Paris",
  assignedToID: null,
  createdByID: "user-1",
  fraudScore: null,
  estimatedAmount: null,
  policyholder: { id: "ph-1", firstName: "Jean", lastName: "Dupont", email: "jean@test.com" },
  assignedTo: null,
  createdBy: { id: "user-1", name: "Manager", email: "manager@test.com", role: "MANAGER" },
  documents: [],
  analyses: [],
  comments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

// ─── GET /api/claims/[id] ─────────────────────────────────────────────────────

describe("GET /api/claims/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as unknown as AuthReturn
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(
      mockClaim as unknown as ClaimReturn
    );
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const req = new NextRequest("http://localhost/api/claims/claim-1");
    const res = await GET(req, makeParams("claim-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when claim not found", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/claims/unknown");
    const res = await GET(req, makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("returns claim data for manager", async () => {
    const req = new NextRequest("http://localhost/api/claims/claim-1");
    const res = await GET(req, makeParams("claim-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data.data.claimNumber).toBe("CLM-2026-00001");
  });

  it("returns 403 for HANDLER who does not own the claim", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as unknown as AuthReturn
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      assignedToID: "another-handler",
      createdByID: "another-handler",
    } as unknown as ClaimReturn);
    const req = new NextRequest("http://localhost/api/claims/claim-1");
    const res = await GET(req, makeParams("claim-1"));
    expect(res.status).toBe(403);
  });

  it("returns claim for HANDLER who is assignee", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as unknown as AuthReturn
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      assignedToID: "handler-1",
      createdByID: "other-user",
    } as unknown as ClaimReturn);
    const req = new NextRequest("http://localhost/api/claims/claim-1");
    const res = await GET(req, makeParams("claim-1"));
    expect(res.status).toBe(200);
  });

  it("returns claim for HANDLER who created it", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as unknown as AuthReturn
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      assignedToID: null,
      createdByID: "handler-1",
    } as unknown as ClaimReturn);
    const req = new NextRequest("http://localhost/api/claims/claim-1");
    const res = await GET(req, makeParams("claim-1"));
    expect(res.status).toBe(200);
  });
});

// ─── PATCH /api/claims/[id] ───────────────────────────────────────────────────

describe("PATCH /api/claims/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as unknown as AuthReturn
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(
      mockClaim as unknown as ClaimReturn
    );
    vi.mocked(prisma.claim.update).mockResolvedValue(
      mockClaim as unknown as ClaimUpdateReturn
    );
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const req = new NextRequest("http://localhost/api/claims/claim-1", {
      method: "PATCH",
      body: JSON.stringify({ description: "Updated description" }),
    });
    const res = await PATCH(req, makeParams("claim-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when claim not found", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/claims/unknown", {
      method: "PATCH",
      body: JSON.stringify({ description: "Updated description" }),
    });
    const res = await PATCH(req, makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid data", async () => {
    const req = new NextRequest("http://localhost/api/claims/claim-1", {
      method: "PATCH",
      body: JSON.stringify({ type: "INVALID_TYPE" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("claim-1"));
    expect(res.status).toBe(400);
  });

  it("updates claim successfully", async () => {
    const req = new NextRequest("http://localhost/api/claims/claim-1", {
      method: "PATCH",
      body: JSON.stringify({ description: "Updated description with enough length" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("claim-1"));
    expect(res.status).toBe(200);
  });

  it("returns 403 for HANDLER not owning the claim", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as unknown as AuthReturn
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      assignedToID: "another-handler",
      createdByID: "another-handler",
    } as unknown as ClaimReturn);
    const req = new NextRequest("http://localhost/api/claims/claim-1", {
      method: "PATCH",
      body: JSON.stringify({ description: "Updated description with enough length" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("claim-1"));
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/claims/[id] ──────────────────────────────────────────────────

describe("DELETE /api/claims/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockAdminSession as unknown as AuthReturn
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(
      mockClaim as unknown as ClaimReturn
    );
    vi.mocked(prisma.claim.delete).mockResolvedValue(
      mockClaim as unknown as ClaimDeleteReturn
    );
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const req = new NextRequest("http://localhost/api/claims/claim-1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("claim-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for HANDLER role (not manager or admin)", async () => {
    vi.mocked(auth).mockResolvedValue(
      { user: { id: "ph-1", email: "ph@test.com", name: "PH", role: "POLICYHOLDER" as const } } as unknown as AuthReturn
    );
    const req = new NextRequest("http://localhost/api/claims/claim-1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("claim-1"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for HANDLER", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as unknown as AuthReturn
    );
    const req = new NextRequest("http://localhost/api/claims/claim-1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("claim-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when claim not found", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/claims/unknown", { method: "DELETE" });
    const res = await DELETE(req, makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("deletes claim successfully for ADMIN", async () => {
    const req = new NextRequest("http://localhost/api/claims/claim-1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("claim-1"));
    expect(res.status).toBe(200);
    expect(prisma.claim.delete).toHaveBeenCalledWith({ where: { id: "claim-1" } });
  });
});
