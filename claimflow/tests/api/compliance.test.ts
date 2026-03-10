/**
 * Tests — Compliance API + services métier :
 * - solvency-service (fonctions pures)
 * - GET /api/compliance/solvency/provisions
 * - POST /api/compliance/solvency/provisions/compute
 * - POST /api/compliance/gdpr/erasure
 * - GET /api/compliance/export/xlsx
 * - GET /api/cron/acpr-monthly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    claim: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      deleteMany: vi.fn(),
    },
    solvencyProvision: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    solvencyReport: {
      upsert: vi.fn(),
    },
    policyholder: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gdprErasureRequest: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gdprDataAccessLog: {
      create: vi.fn(),
    },
    acprReport: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    acprReportConfig: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    weatherCache: {
      count: vi.fn(),
      deleteMany: vi.fn(),
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

vi.mock("@/lib/gdpr-service", () => ({
  anonymizePolicyholder: vi.fn().mockResolvedValue(undefined),
  exportPolicyholderData: vi.fn().mockResolvedValue({ exportedAt: new Date().toISOString(), policyholder: {}, claims: [], auditTrail: [] }),
  purgeStaleClaims: vi.fn().mockResolvedValue(5),
  purgeStaleLogs: vi.fn().mockResolvedValue(10),
  purgeWeatherCache: vi.fn().mockResolvedValue(2),
}));

vi.mock("@/lib/excel-service", () => ({
  generateComplianceXlsx: vi.fn().mockResolvedValue(Buffer.from("xlsx-data")),
}));

vi.mock("@/lib/acpr-service", () => ({
  computeAcprMetrics: vi.fn().mockResolvedValue({
    claimsOpened: 10,
    claimsClosed: 5,
    claimsNew: 3,
    totalProvisioned: 50000,
    fraudRate: 12.5,
    avgProcessingDays: 7.3,
    claimToPremiumRatio: 0.45,
    indemnitesPaid: 20000,
    indemnitesWaiting: 15000,
  }),
  generateAcprPdfBuffer: vi.fn().mockResolvedValue(Buffer.from("pdf-data")),
  computeSha256: vi.fn().mockReturnValue("abc123hash"),
  archiveAcprReport: vi.fn().mockResolvedValue("/storage/reports/report-1.pdf"),
}));

vi.mock("@/lib/solvency-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/solvency-service")>();
  return {
    ...actual,
    computePortfolioProvisions: vi.fn().mockResolvedValue({
      report: { id: "report-1", reportNumber: "SOLV-2026-Q1" },
      claimCount: 8,
      totalBE: 64000,
      totalSCR: 9600,
      totalRM: 1646,
    }),
  };
});

// ─── Imports (après les mocks) ────────────────────────────────────────────────

import {
  computeBestEstimate,
  computeSCR,
  computeRiskMargin,
  getProbabilityResolution,
} from "@/lib/solvency-service";

import { GET as getSolvencyProvisions } from "@/app/api/compliance/solvency/provisions/route";
import { POST as computeProvisions } from "@/app/api/compliance/solvency/provisions/compute/route";
import { GET as getGdprErasure, POST as postGdprErasure } from "@/app/api/compliance/gdpr/erasure/route";
import { GET as getXlsxExport } from "@/app/api/compliance/export/xlsx/route";
import { GET as getCronAcprMonthly } from "@/app/api/cron/acpr-monthly/route";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// ─── Session helpers ──────────────────────────────────────────────────────────

type AuthReturn = ReturnType<typeof auth> extends Promise<infer T> ? T : never;

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.com", name: "Admin", role: "ADMIN" as const },
};
const mockManagerSession = {
  user: { id: "mgr-1", email: "manager@test.com", name: "Manager", role: "MANAGER" as const },
};
const mockHandlerSession = {
  user: { id: "handler-1", email: "handler@test.com", name: "Handler", role: "HANDLER" as const },
};

function setSession(session: typeof mockAdminSession | typeof mockManagerSession | typeof mockHandlerSession | null) {
  vi.mocked(auth).mockResolvedValue(session as unknown as AuthReturn);
}

// ─── solvency-service (fonctions pures) ──────────────────────────────────────

// NOTE: These functions are mocked by vi.mock("@/lib/solvency-service") above.
// We test the real implementations inline here because vi.mock replaces everything.
// To test pure functions, we import and call the real implementations directly
// by bypassing the mock with actual logic tests.

describe("solvency-service pure functions", () => {
  // Since solvency-service is mocked for route tests, we directly test the pure logic
  // by calling the actual implementation from the module. The mock only replaces
  // computePortfolioProvisions (async), the pure exports are still accessible.

  describe("getProbabilityResolution", () => {
    it("returns correct probability for SUBMITTED status", () => {
      const result = getProbabilityResolution("SUBMITTED", "COLLISION");
      expect(result).toBe(0.55);
    });

    it("returns correct probability for APPROVED status", () => {
      const result = getProbabilityResolution("APPROVED", "THEFT");
      expect(result).toBe(0.95);
    });

    it("returns correct probability for REJECTED status", () => {
      const result = getProbabilityResolution("REJECTED", "FIRE");
      expect(result).toBe(0.02);
    });

    it("returns correct probability for CLOSED status", () => {
      const result = getProbabilityResolution("CLOSED", "OTHER");
      expect(result).toBe(0.98);
    });

    it("returns default 0.60 for unknown status", () => {
      const result = getProbabilityResolution("UNKNOWN_STATUS", "COLLISION");
      expect(result).toBe(0.60);
    });
  });

  describe("computeBestEstimate", () => {
    it("returns 0 for null amount", () => {
      const result = computeBestEstimate(null, 0.7);
      expect(result).toBe(0);
    });

    it("returns 0 for zero amount", () => {
      const result = computeBestEstimate(0, 0.7);
      expect(result).toBe(0);
    });

    it("returns 0 for negative amount", () => {
      const result = computeBestEstimate(-100, 0.7);
      expect(result).toBe(0);
    });

    it("multiplies amount by probability", () => {
      const result = computeBestEstimate(10000, 0.7);
      expect(result).toBe(7000);
    });

    it("rounds to 2 decimal places", () => {
      const result = computeBestEstimate(1000, 0.333);
      expect(result).toBe(333);
    });
  });

  describe("computeSCR", () => {
    it("returns 0 for zero bestEstimate", () => {
      const result = computeSCR(0);
      expect(result).toBe(0);
    });

    it("returns max(be * 0.15, 0)", () => {
      const result = computeSCR(10000);
      expect(result).toBe(1500);
    });

    it("never returns negative value", () => {
      const result = computeSCR(-100);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("computeRiskMargin", () => {
    it("returns 6% * scr / riskFreeRate", () => {
      const scr = 1500;
      const riskFreeRate = 0.035;
      const result = computeRiskMargin(scr, riskFreeRate);
      // 0.06 * 1500 / 0.035 = 2571.43
      expect(result).toBeCloseTo(2571.43, 1);
    });

    it("returns 0 when riskFreeRate is 0", () => {
      const result = computeRiskMargin(1500, 0);
      expect(result).toBe(0);
    });

    it("returns 0 when scr is 0", () => {
      const result = computeRiskMargin(0, 0.035);
      expect(result).toBe(0);
    });
  });
});

// ─── GET /api/compliance/solvency/provisions ─────────────────────────────────

describe("GET /api/compliance/solvency/provisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(mockManagerSession);
    vi.mocked(prisma.solvencyProvision.findMany).mockResolvedValue(
      [] as unknown as ReturnType<typeof prisma.solvencyProvision.findMany> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.solvencyProvision.count).mockResolvedValue(0);
  });

  it("returns 401 when not authenticated", async () => {
    setSession(null);
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions");
    const res = await getSolvencyProvisions(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for HANDLER role", async () => {
    setSession(mockHandlerSession);
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions");
    const res = await getSolvencyProvisions(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 with provisions list for MANAGER", async () => {
    vi.mocked(prisma.solvencyProvision.findMany).mockResolvedValue(
      [{ id: "prov-1", claimId: "c-1", periodQuarter: "2026-Q1" }] as unknown as ReturnType<typeof prisma.solvencyProvision.findMany> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.solvencyProvision.count).mockResolvedValue(1);
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions");
    const res = await getSolvencyProvisions(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("returns 200 with provisions list for ADMIN", async () => {
    setSession(mockAdminSession);
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions");
    const res = await getSolvencyProvisions(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid query params", async () => {
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions?quarter=not-a-quarter");
    const res = await getSolvencyProvisions(req);
    expect(res.status).toBe(400);
  });

  it("filters by quarter when provided", async () => {
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions?quarter=2026-Q1");
    const res = await getSolvencyProvisions(req);
    expect(res.status).toBe(200);
    expect(prisma.solvencyProvision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodQuarter: "2026-Q1" },
      })
    );
  });
});

// ─── POST /api/compliance/solvency/provisions/compute ─────────────────────────

describe("POST /api/compliance/solvency/provisions/compute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(mockManagerSession);
  });

  it("returns 401 when not authenticated", async () => {
    setSession(null);
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions/compute", {
      method: "POST",
      body: JSON.stringify({ quarter: "2026-Q1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await computeProvisions(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for HANDLER role", async () => {
    setSession(mockHandlerSession);
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions/compute", {
      method: "POST",
      body: JSON.stringify({ quarter: "2026-Q1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await computeProvisions(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid quarter format", async () => {
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions/compute", {
      method: "POST",
      body: JSON.stringify({ quarter: "Q1-2026" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await computeProvisions(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing quarter", async () => {
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions/compute", {
      method: "POST",
      body: JSON.stringify({ scope: "ALL" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await computeProvisions(req);
    expect(res.status).toBe(400);
  });

  it("returns 201 with result for valid request (MANAGER)", async () => {
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions/compute", {
      method: "POST",
      body: JSON.stringify({ quarter: "2026-Q1", scope: "ALL" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await computeProvisions(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data.data.claimCount).toBe(8);
  });

  it("returns 201 for ADMIN role", async () => {
    setSession(mockAdminSession);
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions/compute", {
      method: "POST",
      body: JSON.stringify({ quarter: "2026-Q2" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await computeProvisions(req);
    expect(res.status).toBe(201);
  });

  it("uses default scope ALL when not provided", async () => {
    const req = new NextRequest("http://localhost/api/compliance/solvency/provisions/compute", {
      method: "POST",
      body: JSON.stringify({ quarter: "2026-Q1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await computeProvisions(req);
    expect(res.status).toBe(201);
  });
});

// ─── POST /api/compliance/gdpr/erasure ───────────────────────────────────────

describe("POST /api/compliance/gdpr/erasure", () => {
  const mockPolicyholder = {
    id: "ph-1",
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean@test.com",
  };

  const mockErasureRequest = {
    id: "erasure-1",
    policyholderId: "ph-1",
    status: "PENDING",
    requestedAt: new Date(),
    requestedById: "admin-1",
    executedAt: null,
    executedById: null,
    metadata: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setSession(mockAdminSession);
    vi.mocked(prisma.policyholder.findUnique).mockResolvedValue(
      mockPolicyholder as unknown as ReturnType<typeof prisma.policyholder.findUnique> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.gdprErasureRequest.create).mockResolvedValue(
      mockErasureRequest as unknown as ReturnType<typeof prisma.gdprErasureRequest.create> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.gdprErasureRequest.findUnique).mockResolvedValue(
      { ...mockErasureRequest, status: "EXECUTED" } as unknown as ReturnType<typeof prisma.gdprErasureRequest.findUnique> extends Promise<infer T> ? T : never
    );
  });

  it("returns 401 when not authenticated", async () => {
    setSession(null);
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure", {
      method: "POST",
      body: JSON.stringify({ policyholderId: "ph-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postGdprErasure(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for MANAGER role (non-ADMIN)", async () => {
    setSession(mockManagerSession);
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure", {
      method: "POST",
      body: JSON.stringify({ policyholderId: "ph-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postGdprErasure(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 for HANDLER role", async () => {
    setSession(mockHandlerSession);
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure", {
      method: "POST",
      body: JSON.stringify({ policyholderId: "ph-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postGdprErasure(req);
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown policyholderId", async () => {
    vi.mocked(prisma.policyholder.findUnique).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure", {
      method: "POST",
      body: JSON.stringify({ policyholderId: "unknown-ph" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postGdprErasure(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing policyholderId", async () => {
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure", {
      method: "POST",
      body: JSON.stringify({ reason: "GDPR request" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postGdprErasure(req);
    expect(res.status).toBe(400);
  });

  it("returns 201 with erasure request when successful", async () => {
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure", {
      method: "POST",
      body: JSON.stringify({ policyholderId: "ph-1", reason: "User requested deletion" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postGdprErasure(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data).toBeDefined();
  });

  it("calls anonymizePolicyholder after creating erasure request", async () => {
    const { anonymizePolicyholder } = await import("@/lib/gdpr-service");
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure", {
      method: "POST",
      body: JSON.stringify({ policyholderId: "ph-1" }),
      headers: { "Content-Type": "application/json" },
    });
    await postGdprErasure(req);
    expect(anonymizePolicyholder).toHaveBeenCalledWith("ph-1", "erasure-1", "admin-1");
  });
});

// ─── GET /api/compliance/gdpr/erasure ────────────────────────────────────────

describe("GET /api/compliance/gdpr/erasure", () => {
  const mockErasureList = [
    { id: "er-1", policyholderId: "ph-1", status: "PENDING", requestedAt: new Date() },
    { id: "er-2", policyholderId: "ph-2", status: "EXECUTED", requestedAt: new Date() },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    setSession(mockAdminSession);
    vi.mocked(prisma.gdprErasureRequest.findMany).mockResolvedValue(
      mockErasureList as unknown as ReturnType<typeof prisma.gdprErasureRequest.findMany> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.gdprErasureRequest.count).mockResolvedValue(2);
  });

  it("returns 401 when not authenticated", async () => {
    setSession(null);
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure");
    const res = await getGdprErasure(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for MANAGER role", async () => {
    setSession(mockManagerSession);
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure");
    const res = await getGdprErasure(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 for HANDLER role", async () => {
    setSession(mockHandlerSession);
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure");
    const res = await getGdprErasure(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 with erasure requests for ADMIN", async () => {
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure");
    const res = await getGdprErasure(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(2);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("filters by status when provided", async () => {
    vi.mocked(prisma.gdprErasureRequest.findMany).mockResolvedValue(
      [mockErasureList[0]] as unknown as ReturnType<typeof prisma.gdprErasureRequest.findMany> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.gdprErasureRequest.count).mockResolvedValue(1);
    const req = new NextRequest("http://localhost/api/compliance/gdpr/erasure?status=PENDING");
    const res = await getGdprErasure(req);
    expect(res.status).toBe(200);
    expect(prisma.gdprErasureRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDING" } })
    );
  });
});

// ─── GET /api/compliance/export/xlsx ─────────────────────────────────────────

describe("GET /api/compliance/export/xlsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(mockAdminSession);
  });

  it("returns 401 when not authenticated", async () => {
    setSession(null);
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?period=month&year=2026&month=1");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for MANAGER role (non-ADMIN)", async () => {
    setSession(mockManagerSession);
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?period=month&year=2026&month=1");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 for HANDLER role", async () => {
    setSession(mockHandlerSession);
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?period=month&year=2026&month=1");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing period param", async () => {
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?year=2026");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid period value", async () => {
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?period=week&year=2026");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing year param", async () => {
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?period=month");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with xlsx file for valid month request", async () => {
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?period=month&year=2026&month=1");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
  });

  it("returns 200 with xlsx file for quarter request", async () => {
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?period=quarter&year=2026&quarter=Q1");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(200);
  });

  it("returns 200 with xlsx file for year request", async () => {
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?period=year&year=2026");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(200);
  });

  it("includes correct Content-Disposition header", async () => {
    const req = new NextRequest("http://localhost/api/compliance/export/xlsx?period=year&year=2026");
    const res = await getXlsxExport(req);
    expect(res.status).toBe(200);
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(".xlsx");
  });
});

// ─── GET /api/cron/acpr-monthly ───────────────────────────────────────────────

describe("GET /api/cron/acpr-monthly", () => {
  const CRON_SECRET = "test-cron-secret";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    vi.mocked(prisma.acprReport.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.acprReportConfig.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.acprReport.create).mockResolvedValue(
      { id: "report-1", reportNumber: "ACPR-2026-02" } as unknown as ReturnType<typeof prisma.acprReport.create> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.acprReport.update).mockResolvedValue(
      { id: "report-1" } as unknown as ReturnType<typeof prisma.acprReport.update> extends Promise<infer T> ? T : never
    );
  });

  it("returns 401 without CRON_SECRET header", async () => {
    const req = new NextRequest("http://localhost/api/cron/acpr-monthly");
    const res = await getCronAcprMonthly(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong CRON_SECRET", async () => {
    const req = new NextRequest("http://localhost/api/cron/acpr-monthly", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await getCronAcprMonthly(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET env var is not set", async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest("http://localhost/api/cron/acpr-monthly", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await getCronAcprMonthly(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with valid CRON_SECRET", async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    const req = new NextRequest("http://localhost/api/cron/acpr-monthly", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await getCronAcprMonthly(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.reportNumber).toBeDefined();
  });

  it("returns 200 with message when report already exists", async () => {
    vi.mocked(prisma.acprReport.findUnique).mockResolvedValue(
      { id: "existing-report", reportNumber: "ACPR-2026-02" } as unknown as ReturnType<typeof prisma.acprReport.findUnique> extends Promise<infer T> ? T : never
    );
    const req = new NextRequest("http://localhost/api/cron/acpr-monthly", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await getCronAcprMonthly(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("déjà généré");
  });

  it("uses custom config when acprReportConfig exists", async () => {
    vi.mocked(prisma.acprReportConfig.findFirst).mockResolvedValue(
      {
        id: "config-1",
        headerTitle: "Mon Rapport ACPR",
        headerSubtitle: "Sous-titre",
        footerText: "Pied de page",
        sections: JSON.stringify(["claims", "fraud"]),
        updatedAt: new Date(),
      } as unknown as ReturnType<typeof prisma.acprReportConfig.findFirst> extends Promise<infer T> ? T : never
    );
    const req = new NextRequest("http://localhost/api/cron/acpr-monthly", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await getCronAcprMonthly(req);
    expect(res.status).toBe(200);
  });
});
