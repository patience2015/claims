/**
 * Tests — POST /api/claims/[id]/assign
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    claim: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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

import { POST } from "@/app/api/claims/[id]/assign/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createNotification } from "@/lib/notification-service";

type AuthReturn = ReturnType<typeof auth> extends Promise<infer T> ? T : never;
type ClaimReturn = ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never;
type ClaimUpdateReturn = ReturnType<typeof prisma.claim.update> extends Promise<infer T> ? T : never;
type UserReturn = ReturnType<typeof prisma.user.findUnique> extends Promise<infer T> ? T : never;

const mockManagerSession = {
  user: { id: "mgr-1", email: "manager@test.com", name: "Manager", role: "MANAGER" as const },
};

const mockHandlerSession = {
  user: { id: "handler-1", email: "handler@test.com", name: "Handler", role: "HANDLER" as const },
};

const mockClaim = {
  id: "claim-1",
  claimNumber: "CLM-2026-00001",
  status: "SUBMITTED",
  assignedToID: null,
};

const mockTargetUser = {
  id: "cjld2cyuq0000t3rmniod1foy",
  name: "Target Handler",
  email: "target@test.com",
  role: "HANDLER",
  active: true,
};

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/claims/claim-1/assign", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("POST /api/claims/[id]/assign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as unknown as AuthReturn
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(
      mockClaim as unknown as ClaimReturn
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockTargetUser as unknown as UserReturn
    );
    vi.mocked(prisma.claim.update).mockResolvedValue({
      ...mockClaim,
      assignedToID: mockTargetUser.id,
      status: "UNDER_REVIEW",
      policyholder: {},
      assignedTo: mockTargetUser,
      createdBy: {},
    } as unknown as ClaimUpdateReturn);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const res = await POST(
      makeRequest({ userId: "cjld2cyuq0000t3rmniod1foy" }),
      makeParams("claim-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for HANDLER role", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as unknown as AuthReturn
    );
    const res = await POST(
      makeRequest({ userId: "cjld2cyuq0000t3rmniod1foy" }),
      makeParams("claim-1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid userId", async () => {
    const res = await POST(makeRequest({ userId: "not-a-cuid" }), makeParams("claim-1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when claim not found", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(null);
    const res = await POST(
      makeRequest({ userId: "cjld2cyuq0000t3rmniod1foy" }),
      makeParams("unknown")
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when target user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const res = await POST(
      makeRequest({ userId: "cjld2cyuq0000t3rmniod1foy" }),
      makeParams("claim-1")
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when target user is inactive", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockTargetUser,
      active: false,
    } as unknown as UserReturn);
    const res = await POST(
      makeRequest({ userId: "cjld2cyuq0000t3rmniod1foy" }),
      makeParams("claim-1")
    );
    expect(res.status).toBe(404);
  });

  it("assigns claim successfully and changes status to UNDER_REVIEW when SUBMITTED", async () => {
    const res = await POST(
      makeRequest({ userId: "cjld2cyuq0000t3rmniod1foy" }),
      makeParams("claim-1")
    );
    expect(res.status).toBe(200);
    expect(prisma.claim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedToID: "cjld2cyuq0000t3rmniod1foy",
          status: "UNDER_REVIEW",
        }),
      })
    );
  });

  it("keeps existing status when claim is not SUBMITTED", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      status: "UNDER_REVIEW",
    } as unknown as ClaimReturn);
    await POST(makeRequest({ userId: "cjld2cyuq0000t3rmniod1foy" }), makeParams("claim-1"));
    expect(prisma.claim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "UNDER_REVIEW" }),
      })
    );
  });

  it("creates notification for the assigned user", async () => {
    await POST(makeRequest({ userId: "cjld2cyuq0000t3rmniod1foy" }), makeParams("claim-1"));
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "cjld2cyuq0000t3rmniod1foy",
        type: "CLAIM_ASSIGNED",
        claimId: "claim-1",
      })
    );
  });
});
