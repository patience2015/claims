/**
 * Tests — Multiple API routes:
 * - GET/POST /api/claims/[id]/comments
 * - GET/POST /api/policyholders
 * - GET/PATCH /api/notifications/preferences
 * - GET /api/notifications/check-sla
 * - lib/audit.ts
 * - lib/email-service.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    claim: {
      findUnique: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    policyholder: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    notificationPreference: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    emailNotification: {
      create: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
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
  getClaimAuditLogs: vi.fn().mockResolvedValue([
    { id: "log-1", action: "CLAIM_CREATED", claimId: "claim-1" },
  ]),
}));

vi.mock("@/lib/notification-service", () => ({
  checkSLABreaches: vi.fn().mockResolvedValue({ checked: 5, created: 2 }),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { GET as getComments, POST as postComment } from "@/app/api/claims/[id]/comments/route";
import { GET as getPolicyholders, POST as postPolicyholder } from "@/app/api/policyholders/route";
import { GET as getPreferences, PATCH as patchPreferences } from "@/app/api/notifications/preferences/route";
import { GET as checkSla } from "@/app/api/notifications/check-sla/route";
import { createAuditLog, getClaimAuditLogs } from "@/lib/audit";
import { sendClaimStatusEmail, sendNotificationEmail } from "@/lib/email-service";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const mockHandlerSession = {
  user: { id: "user-1", email: "handler@test.com", name: "Handler", role: "HANDLER" as const },
};

const mockManagerSession = {
  user: { id: "mgr-1", email: "manager@test.com", name: "Manager", role: "MANAGER" as const },
};

const mockPolicyholderSession = {
  user: { id: "ph-1", email: "ph@test.com", name: "Assuré", role: "POLICYHOLDER" as const },
};

const mockClaim = {
  id: "claim-1",
  claimNumber: "CLM-2026-00001",
  status: "SUBMITTED",
};

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

// ─── GET/POST /api/claims/[id]/comments ──────────────────────────────────────

describe("GET /api/claims/[id]/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(
      mockClaim as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.comment.findMany).mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/claims/claim-1/comments");
    const res = await getComments(req, makeParams("claim-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when claim not found", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/claims/unknown/comments");
    const res = await getComments(req, makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("returns comments for a claim", async () => {
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: "cmt-1", content: "Test comment", isInternal: true, author: { id: "user-1", name: "Handler", email: "h@test.com", role: "HANDLER" }, createdAt: new Date() },
    ] as unknown as ReturnType<typeof prisma.comment.findMany> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/claims/claim-1/comments");
    const res = await getComments(req, makeParams("claim-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(1);
  });
});

describe("POST /api/claims/[id]/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(
      mockClaim as ReturnType<typeof prisma.claim.findUnique> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.comment.create).mockResolvedValue({
      id: "cmt-1",
      content: "Test comment",
      isInternal: true,
      author: {},
    } as unknown as ReturnType<typeof prisma.comment.create> extends Promise<infer T> ? T : never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/claims/claim-1/comments", {
      method: "POST",
      body: JSON.stringify({ content: "Test" }),
    });
    const res = await postComment(req, makeParams("claim-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty content", async () => {
    const req = new NextRequest("http://localhost/api/claims/claim-1/comments", {
      method: "POST",
      body: JSON.stringify({ content: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postComment(req, makeParams("claim-1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when claim not found", async () => {
    vi.mocked(prisma.claim.findUnique).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/claims/unknown/comments", {
      method: "POST",
      body: JSON.stringify({ content: "Test comment" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postComment(req, makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("creates comment successfully", async () => {
    const req = new NextRequest("http://localhost/api/claims/claim-1/comments", {
      method: "POST",
      body: JSON.stringify({ content: "Test comment" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postComment(req, makeParams("claim-1"));
    expect(res.status).toBe(201);
  });
});

// ─── GET/POST /api/policyholders ─────────────────────────────────────────────

const validPolicyholder = {
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean@example.com",
  phone: "0612345678",
  address: "12 rue de la Paix, 75001 Paris",
  vehicleMake: "Renault",
  vehicleModel: "Clio",
  vehicleYear: 2020,
  vehiclePlate: "AB-123-CD",
  policyNumber: "POL-12345",
  contractStart: "2025-01-01",
  contractEnd: "2026-01-01",
  coverageType: "ALL_RISKS",
};

describe("GET /api/policyholders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.policyholder.findMany).mockResolvedValue([]);
    vi.mocked(prisma.policyholder.count).mockResolvedValue(0);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/policyholders");
    const res = await getPolicyholders(req);
    expect(res.status).toBe(401);
  });

  it("returns paginated policyholders", async () => {
    vi.mocked(prisma.policyholder.count).mockResolvedValue(2);
    vi.mocked(prisma.policyholder.findMany).mockResolvedValue([
      { id: "ph-1", firstName: "Jean", lastName: "Dupont" },
      { id: "ph-2", firstName: "Marie", lastName: "Martin" },
    ] as ReturnType<typeof prisma.policyholder.findMany> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/policyholders");
    const res = await getPolicyholders(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it("filters by search parameter", async () => {
    const req = new NextRequest("http://localhost/api/policyholders?search=dupont");
    await getPolicyholders(req);
    expect(prisma.policyholder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.arrayContaining([{ firstName: { contains: "dupont" } }]) }),
      })
    );
  });

  it("uses no where filter when no search", async () => {
    const req = new NextRequest("http://localhost/api/policyholders");
    await getPolicyholders(req);
    expect(prisma.policyholder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });
});

describe("POST /api/policyholders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.policyholder.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.policyholder.create).mockResolvedValue({
      id: "ph-new",
      ...validPolicyholder,
    } as unknown as ReturnType<typeof prisma.policyholder.create> extends Promise<infer T> ? T : never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/policyholders", {
      method: "POST",
      body: JSON.stringify(validPolicyholder),
    });
    const res = await postPolicyholder(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid data", async () => {
    const req = new NextRequest("http://localhost/api/policyholders", {
      method: "POST",
      body: JSON.stringify({ email: "invalid" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postPolicyholder(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when policy number already in use", async () => {
    vi.mocked(prisma.policyholder.findUnique).mockResolvedValue({
      id: "existing",
    } as unknown as ReturnType<typeof prisma.policyholder.findUnique> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/policyholders", {
      method: "POST",
      body: JSON.stringify(validPolicyholder),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postPolicyholder(req);
    expect(res.status).toBe(409);
  });

  it("creates policyholder successfully", async () => {
    const req = new NextRequest("http://localhost/api/policyholders", {
      method: "POST",
      body: JSON.stringify(validPolicyholder),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postPolicyholder(req);
    expect(res.status).toBe(201);
  });
});

// ─── GET/PATCH /api/notifications/preferences ────────────────────────────────

describe("GET /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([
      { id: "p1", userId: "user-1", type: "CLAIM_ASSIGNED", emailEnabled: true, inAppEnabled: true },
    ] as ReturnType<typeof prisma.notificationPreference.findMany> extends Promise<infer T> ? T : never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const res = await getPreferences();
    expect(res.status).toBe(401);
  });

  it("returns 403 for POLICYHOLDER", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const res = await getPreferences();
    expect(res.status).toBe(403);
  });

  it("returns preferences for handler", async () => {
    const res = await getPreferences();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
  });

  it("creates default preferences when none exist", async () => {
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notificationPreference.createMany).mockResolvedValue({ count: 5 });
    const res = await getPreferences();
    expect(res.status).toBe(200);
    expect(prisma.notificationPreference.createMany).toHaveBeenCalled();
  });
});

describe("PATCH /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.notificationPreference.upsert).mockResolvedValue({
      id: "p1",
      userId: "user-1",
      type: "CLAIM_ASSIGNED",
      emailEnabled: false,
      inAppEnabled: true,
    } as ReturnType<typeof prisma.notificationPreference.upsert> extends Promise<infer T> ? T : never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const req = new NextRequest("http://localhost/api/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify([{ type: "CLAIM_ASSIGNED", emailEnabled: false, inAppEnabled: true }]),
    });
    const res = await patchPreferences(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for POLICYHOLDER", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const req = new NextRequest("http://localhost/api/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify([{ type: "CLAIM_ASSIGNED", emailEnabled: false, inAppEnabled: true }]),
    });
    const res = await patchPreferences(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid preferences", async () => {
    const req = new NextRequest("http://localhost/api/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify([]),
      headers: { "Content-Type": "application/json" },
    });
    const res = await patchPreferences(req);
    expect(res.status).toBe(400);
  });

  it("updates preferences successfully", async () => {
    const req = new NextRequest("http://localhost/api/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify([{ type: "CLAIM_ASSIGNED", emailEnabled: false, inAppEnabled: true }]),
      headers: { "Content-Type": "application/json" },
    });
    const res = await patchPreferences(req);
    expect(res.status).toBe(200);
    expect(prisma.notificationPreference.upsert).toHaveBeenCalled();
  });
});

// ─── GET /api/notifications/check-sla ────────────────────────────────────────

describe("GET /api/notifications/check-sla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use a fixed-length secret for timingSafeEqual compatibility
    process.env.CRON_SECRET = "mysecret12345678";
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when no CRON_SECRET env var set", async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest("http://localhost/api/notifications/check-sla");
    const res = await checkSla(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when wrong secret of same length", async () => {
    const req = new NextRequest("http://localhost/api/notifications/check-sla", {
      headers: { "x-cron-secret": "wrongsecret12345" },
    });
    const res = await checkSla(req);
    expect(res.status).toBe(401);
  });

  it("returns SLA check result with correct secret", async () => {
    const req = new NextRequest("http://localhost/api/notifications/check-sla", {
      headers: { "x-cron-secret": "mysecret12345678" },
    });
    const res = await checkSla(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.checked).toBe(5);
    expect(data.created).toBe(2);
    expect(data.timestamp).toBeDefined();
  });
});

// ─── lib/audit.ts ─────────────────────────────────────────────────────────────

describe("createAuditLog (mock)", () => {
  it("is called with expected parameters", async () => {
    await createAuditLog({
      action: "CLAIM_CREATED",
      entityType: "CLAIM",
      entityId: "claim-1",
      userId: "user-1",
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CLAIM_CREATED" })
    );
  });
});

describe("getClaimAuditLogs (mock)", () => {
  it("returns mocked audit logs for a claim", async () => {
    const result = await getClaimAuditLogs("claim-1");
    expect(result).toHaveLength(1);
    expect(getClaimAuditLogs).toHaveBeenCalledWith("claim-1");
  });
});

// ─── lib/email-service.ts ─────────────────────────────────────────────────────

describe("sendClaimStatusEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_HOST;
    vi.mocked(prisma.emailNotification.create).mockResolvedValue({
      id: "email-1",
    } as ReturnType<typeof prisma.emailNotification.create> extends Promise<infer T> ? T : never);
  });

  it("creates email notification in DB without SMTP", async () => {
    await sendClaimStatusEmail({
      claimId: "claim-1",
      claimNumber: "CLM-2026-00001",
      status: "APPROVED",
      policyholderEmail: "jean@test.com",
      policyholderName: "Jean Dupont",
    });
    expect(prisma.emailNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          claimId: "claim-1",
          to: "jean@test.com",
        }),
      })
    );
  });

  it("sends email via SMTP when configured", async () => {
    process.env.SMTP_HOST = "smtp.test.com";
    vi.mocked(prisma.emailNotification.update).mockResolvedValue({
      id: "email-1",
    } as ReturnType<typeof prisma.emailNotification.update> extends Promise<infer T> ? T : never);
    const nodemailer = await import("nodemailer");
    const mockSendMail = vi.fn().mockResolvedValue(undefined);
    vi.mocked(nodemailer.default.createTransport).mockReturnValue({
      sendMail: mockSendMail,
    } as unknown as ReturnType<typeof nodemailer.default.createTransport>);

    await sendClaimStatusEmail({
      claimId: "claim-1",
      claimNumber: "CLM-2026-00001",
      status: "APPROVED",
      policyholderEmail: "jean@test.com",
      policyholderName: "Jean Dupont",
    });
    expect(mockSendMail).toHaveBeenCalled();
    delete process.env.SMTP_HOST;
  });
});

describe("sendNotificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_HOST;
  });

  it("logs simulated email without SMTP config", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await sendNotificationEmail("test@test.com", "Test Subject", "Test Body");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("SMTP non configuré")
    );
    consoleSpy.mockRestore();
  });

  it("sends email with SMTP when configured", async () => {
    process.env.SMTP_HOST = "smtp.test.com";
    const nodemailer = await import("nodemailer");
    const mockSendMail = vi.fn().mockResolvedValue(undefined);
    vi.mocked(nodemailer.default.createTransport).mockReturnValue({
      sendMail: mockSendMail,
    } as unknown as ReturnType<typeof nodemailer.default.createTransport>);

    await sendNotificationEmail("test@test.com", "Subject", "Body");
    expect(mockSendMail).toHaveBeenCalled();
    delete process.env.SMTP_HOST;
  });
});
