/**
 * Tests — POST /api/portail/claims/[id]/decision
 * Route : acceptation / refus d'une proposition d'indemnisation par l'assuré
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    policyholder: {
      findUnique: vi.fn(),
    },
    claim: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/portail/claims/[id]/decision/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const mockPolicyholderSession = {
  user: {
    id: "user-ph-1",
    email: "marie.dupont@email.fr",
    name: "Marie Dupont",
    role: "POLICYHOLDER" as const,
    policyholderID: "ph-1",
  },
};

const mockPolicyholder = { id: "ph-1", userId: "user-ph-1" };

const mockApprovedClaim = {
  id: "claim-1",
  claimNumber: "CLM-2026-00001",
  status: "APPROVED",
  policyholderID: "ph-1",
  approvedAmount: 1500,
};

const makeRequest = (id: string, body: object) =>
  new NextRequest(`http://localhost:3000/api/portail/claims/${id}/decision`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/portail/claims/[id]/decision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.policyholder.findUnique).mockResolvedValue(
      mockPolicyholder as ReturnType<typeof prisma.policyholder.findUnique> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(
      mockApprovedClaim as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.update).mockResolvedValue({
      ...mockApprovedClaim,
      status: "CLOSED",
      closureReason: "Proposition acceptée par l'assuré",
    } as ReturnType<typeof prisma.claim.update> extends Promise<infer T> ? T : never);
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const res = await POST(makeRequest("claim-1", { decision: "ACCEPT" }), makeParams("claim-1"));
    expect(res.status).toBe(401);
  });

  it("retourne 403 si rôle non POLICYHOLDER", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", role: "HANDLER", policyholderID: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const res = await POST(makeRequest("claim-1", { decision: "ACCEPT" }), makeParams("claim-1"));
    expect(res.status).toBe(403);
  });

  it("retourne 404 si profil assuré introuvable", async () => {
    vi.mocked(prisma.policyholder.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("claim-1", { decision: "ACCEPT" }), makeParams("claim-1"));
    expect(res.status).toBe(404);
  });

  it("retourne 404 si sinistre inexistant", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("claim-1", { decision: "ACCEPT" }), makeParams("claim-1"));
    expect(res.status).toBe(404);
  });

  it("retourne 403 si le sinistre appartient à un autre assuré", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockApprovedClaim,
      policyholderID: "autre-ph",
    } as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never);
    const res = await POST(makeRequest("claim-1", { decision: "ACCEPT" }), makeParams("claim-1"));
    expect(res.status).toBe(403);
  });

  it("retourne 400 si le sinistre n'est pas en statut APPROVED", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockApprovedClaim,
      status: "SUBMITTED",
    } as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never);
    const res = await POST(makeRequest("claim-1", { decision: "ACCEPT" }), makeParams("claim-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Aucune décision disponible");
  });

  it("retourne 400 si décision invalide", async () => {
    const res = await POST(makeRequest("claim-1", { decision: "MAYBE" }), makeParams("claim-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Données invalides");
  });

  it("accepte la proposition et passe le sinistre à CLOSED", async () => {
    const res = await POST(makeRequest("claim-1", { decision: "ACCEPT" }), makeParams("claim-1"));
    expect(res.status).toBe(200);
    expect(prisma.claim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "claim-1" },
        data: expect.objectContaining({
          status: "CLOSED",
          closureReason: expect.stringContaining("acceptée"),
        }),
      })
    );
  });

  it("refuse la proposition avec un motif valide", async () => {
    vi.mocked(prisma.claim.update).mockResolvedValue({
      ...mockApprovedClaim,
      status: "CLOSED",
      closureReason: "Proposition refusée par l'assuré : Le montant ne couvre pas mes frais réels.",
    } as ReturnType<typeof prisma.claim.update> extends Promise<infer T> ? T : never);

    const res = await POST(
      makeRequest("claim-1", {
        decision: "REJECT",
        reason: "Le montant ne couvre pas mes frais réels.",
      }),
      makeParams("claim-1")
    );
    expect(res.status).toBe(200);
    expect(prisma.claim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          closureReason: expect.stringContaining("refusée"),
        }),
      })
    );
  });

  it("retourne 400 si motif de refus trop court (< 20 chars)", async () => {
    const res = await POST(
      makeRequest("claim-1", { decision: "REJECT", reason: "Trop court" }),
      makeParams("claim-1")
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Données invalides");
  });

  it("retourne 400 si REJECT sans motif", async () => {
    const res = await POST(
      makeRequest("claim-1", { decision: "REJECT" }),
      makeParams("claim-1")
    );
    expect(res.status).toBe(400);
  });

  it("crée un audit log après la décision", async () => {
    const { createAuditLog } = await import("@/lib/audit");
    await POST(makeRequest("claim-1", { decision: "ACCEPT" }), makeParams("claim-1"));
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "STATUS_CHANGED",
        claimId: "claim-1",
      })
    );
  });
});
