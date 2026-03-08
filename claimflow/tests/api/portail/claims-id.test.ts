/**
 * Tests — GET /api/portail/claims/[id]
 * Route : détail d'un sinistre pour l'assuré connecté
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    claim: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { GET } from "@/app/api/portail/claims/[id]/route";
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

const mockClaim = {
  id: "claim-1",
  claimNumber: "CLM-2026-00001",
  status: "SUBMITTED",
  type: "COLLISION",
  description: "Accrochage au carrefour",
  incidentDate: new Date("2026-01-15"),
  incidentLocation: "Paris",
  thirdPartyInvolved: false,
  estimatedAmount: null,
  approvedAmount: null,
  closureReason: null,
  policyholderID: "ph-1",
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  documents: [],
};

const makeRequest = (id: string) =>
  new NextRequest(`http://localhost:3000/api/portail/claims/${id}`);
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/portail/claims/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(
      mockClaim as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never
    );
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    expect(res.status).toBe(401);
  });

  it("retourne 403 si rôle non POLICYHOLDER", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", role: "HANDLER", policyholderID: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    expect(res.status).toBe(403);
  });

  it("retourne 404 si sinistre inexistant", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("unknown"), makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("retourne 403 si le sinistre appartient à un autre assuré", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      policyholderID: "autre-ph",
    } as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never);
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Accès refusé");
  });

  it("retourne le détail du sinistre avec canUpload et canDecide", async () => {
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.claimNumber).toBe("CLM-2026-00001");
    expect(data.data).toHaveProperty("canUpload");
    expect(data.data).toHaveProperty("canDecide");
  });

  it("canUpload est true pour statut SUBMITTED", async () => {
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    const data = await res.json();
    expect(data.data.canUpload).toBe(true);
  });

  it("canUpload est true pour statut INFO_REQUESTED", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      status: "INFO_REQUESTED",
    } as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never);
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    const data = await res.json();
    expect(data.data.canUpload).toBe(true);
  });

  it("canUpload est false pour statut CLOSED", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      status: "CLOSED",
    } as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never);
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    const data = await res.json();
    expect(data.data.canUpload).toBe(false);
  });

  it("canDecide est true pour statut APPROVED avec approvedAmount", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      status: "APPROVED",
      approvedAmount: 1500,
    } as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never);
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    const data = await res.json();
    expect(data.data.canDecide).toBe(true);
  });

  it("canDecide est false pour statut APPROVED sans approvedAmount", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      status: "APPROVED",
      approvedAmount: null,
    } as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never);
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    const data = await res.json();
    expect(data.data.canDecide).toBe(false);
  });

  it("retourne les documents associés", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue({
      ...mockClaim,
      documents: [
        { id: "doc-1", filename: "constat.pdf", mimeType: "application/pdf", size: 1024, url: "/uploads/claim-1/constat.pdf", createdAt: new Date() },
      ],
    } as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never);
    const res = await GET(makeRequest("claim-1"), makeParams("claim-1"));
    const data = await res.json();
    expect(data.data.documents).toHaveLength(1);
    expect(data.data.documents[0].filename).toBe("constat.pdf");
  });
});
