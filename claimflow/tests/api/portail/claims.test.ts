/**
 * Tests — GET /api/portail/claims
 * Route : liste des sinistres d'un assuré connecté
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    claim: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { GET } from "@/app/api/portail/claims/route";
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

const mockClaims = [
  {
    id: "claim-1",
    claimNumber: "CLM-2026-00001",
    status: "SUBMITTED",
    type: "COLLISION",
    incidentDate: new Date("2026-01-15"),
    incidentLocation: "Paris",
    estimatedAmount: null,
    approvedAmount: null,
    createdAt: new Date("2026-01-15"),
  },
  {
    id: "claim-2",
    claimNumber: "CLM-2026-00002",
    status: "APPROVED",
    type: "GLASS",
    incidentDate: new Date("2026-02-01"),
    incidentLocation: "Lyon",
    estimatedAmount: 450,
    approvedAmount: 420,
    createdAt: new Date("2026-02-01"),
  },
];

describe("GET /api/portail/claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.claim.findMany).mockResolvedValue(
      mockClaims as ReturnType<typeof prisma.claim.findMany> extends Promise<infer T> ? T : never
    );
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/api/portail/claims");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Non autorisé");
  });

  it("retourne 403 si rôle non POLICYHOLDER", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", role: "HANDLER", policyholderID: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost:3000/api/portail/claims");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("retourne 404 si POLICYHOLDER sans policyholderID en session", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", role: "POLICYHOLDER", policyholderID: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost:3000/api/portail/claims");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("retourne la liste des sinistres de l'assuré", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const req = new NextRequest("http://localhost:3000/api/portail/claims");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.data[0].claimNumber).toBe("CLM-2026-00001");
  });

  it("filtre les sinistres par policyholderID de la session", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const req = new NextRequest("http://localhost:3000/api/portail/claims");
    await GET(req);
    expect(prisma.claim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyholderID: "ph-1" },
      })
    );
  });

  it("retourne un tableau vide si aucun sinistre", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    const req = new NextRequest("http://localhost:3000/api/portail/claims");
    const res = await GET(req);
    const data = await res.json();
    expect(data.data).toHaveLength(0);
  });

  it("trie les sinistres par date de création décroissante", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const req = new NextRequest("http://localhost:3000/api/portail/claims");
    await GET(req);
    expect(prisma.claim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });
});
