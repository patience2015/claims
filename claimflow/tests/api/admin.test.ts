/**
 * Tests — GET/POST /api/admin/users, GET /api/admin/audit-logs
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
  hash: vi.fn().mockResolvedValue("hashed-password"),
}));

import { GET as getUsers, POST as postUser } from "@/app/api/admin/users/route";
import { GET as getAuditLogs } from "@/app/api/admin/audit-logs/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type AuthReturn = ReturnType<typeof auth> extends Promise<infer T> ? T : never;
type UserFindManyReturn = ReturnType<typeof prisma.user.findMany> extends Promise<infer T> ? T : never;
type UserFindUniqueReturn = ReturnType<typeof prisma.user.findUnique> extends Promise<infer T> ? T : never;
type UserCreateReturn = ReturnType<typeof prisma.user.create> extends Promise<infer T> ? T : never;

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.com", name: "Admin", role: "ADMIN" as const },
};

const mockManagerSession = {
  user: { id: "mgr-1", email: "manager@test.com", name: "Manager", role: "MANAGER" as const },
};

const mockHandlerSession = {
  user: { id: "handler-1", email: "handler@test.com", name: "Handler", role: "HANDLER" as const },
};

const mockUsers = [
  { id: "user-1", email: "h1@test.com", name: "Handler 1", role: "HANDLER", active: true, createdAt: new Date(), _count: { assignedClaims: 2 } },
  { id: "user-2", email: "h2@test.com", name: "Handler 2", role: "HANDLER", active: true, createdAt: new Date(), _count: { assignedClaims: 0 } },
];

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockAdminSession as unknown as AuthReturn
    );
    vi.mocked(prisma.user.findMany).mockResolvedValue(
      mockUsers as unknown as UserFindManyReturn
    );
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const req = new NextRequest("http://localhost/api/admin/users");
    const res = await getUsers(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for HANDLER", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as unknown as AuthReturn
    );
    const req = new NextRequest("http://localhost/api/admin/users");
    const res = await getUsers(req);
    expect(res.status).toBe(403);
  });

  it("returns users list for ADMIN", async () => {
    const req = new NextRequest("http://localhost/api/admin/users");
    const res = await getUsers(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
  });

  it("MANAGER only sees HANDLERs", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as unknown as AuthReturn
    );
    const req = new NextRequest("http://localhost/api/admin/users");
    await getUsers(req);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "HANDLER" }),
      })
    );
  });

  it("ADMIN can filter by role", async () => {
    const req = new NextRequest("http://localhost/api/admin/users?role=MANAGER");
    await getUsers(req);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "MANAGER" }),
      })
    );
  });
});

// ─── POST /api/admin/users ────────────────────────────────────────────────────

describe("POST /api/admin/users", () => {
  const validUser = {
    email: "new@test.com",
    name: "New User",
    password: "password123",
    role: "HANDLER",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockAdminSession as unknown as AuthReturn
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "new-user-1",
      email: "new@test.com",
      name: "New User",
      role: "HANDLER",
      active: true,
      createdAt: new Date(),
    } as unknown as UserCreateReturn);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify(validUser),
    });
    const res = await postUser(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as unknown as AuthReturn
    );
    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify(validUser),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postUser(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid user data", async () => {
    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email: "invalid" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postUser(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when email already in use", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "existing",
      email: "new@test.com",
    } as unknown as UserFindUniqueReturn);
    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify(validUser),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postUser(req);
    expect(res.status).toBe(409);
  });

  it("creates user successfully", async () => {
    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify(validUser),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postUser(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data).toBeDefined();
  });
});

// ─── GET /api/admin/audit-logs ───────────────────────────────────────────────

describe("GET /api/admin/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockAdminSession as unknown as AuthReturn
    );
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as AuthReturn);
    const req = new NextRequest("http://localhost/api/admin/audit-logs");
    const res = await getAuditLogs(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for HANDLER", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as unknown as AuthReturn
    );
    const req = new NextRequest("http://localhost/api/admin/audit-logs");
    const res = await getAuditLogs(req);
    expect(res.status).toBe(403);
  });

  it("returns audit logs for ADMIN", async () => {
    const req = new NextRequest("http://localhost/api/admin/audit-logs");
    const res = await getAuditLogs(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("totalPages");
  });

  it("returns audit logs for MANAGER", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as unknown as AuthReturn
    );
    const req = new NextRequest("http://localhost/api/admin/audit-logs");
    const res = await getAuditLogs(req);
    expect(res.status).toBe(200);
  });

  it("filters by claimId", async () => {
    const req = new NextRequest("http://localhost/api/admin/audit-logs?claimId=claim-1");
    await getAuditLogs(req);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ claimId: "claim-1" }),
      })
    );
  });

  it("filters by userId and action", async () => {
    const req = new NextRequest("http://localhost/api/admin/audit-logs?userId=user-1&action=CLAIM_CREATED");
    await getAuditLogs(req);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", action: "CLAIM_CREATED" }),
      })
    );
  });

  it("paginates results", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(100);
    const req = new NextRequest("http://localhost/api/admin/audit-logs?page=2&pageSize=25");
    const res = await getAuditLogs(req);
    const data = await res.json();
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(25);
  });
});
