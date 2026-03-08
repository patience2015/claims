/**
 * Tests — API Notifications
 * GET /api/notifications, PATCH /api/notifications/read-all,
 * PATCH /api/notifications/[id]/read, GET /api/notifications/unread-count
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/notifications/route";
import { PATCH as patchReadAll } from "@/app/api/notifications/read-all/route";
import { GET as getUnreadCount } from "@/app/api/notifications/unread-count/route";
import { PATCH as patchRead } from "@/app/api/notifications/[id]/read/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const mockHandlerSession = {
  user: { id: "user-1", email: "handler@test.com", name: "Handler", role: "HANDLER" as const },
};

const mockManagerSession = {
  user: { id: "user-2", email: "manager@test.com", name: "Manager", role: "MANAGER" as const },
};

const mockPolicyholderSession = {
  user: { id: "user-ph", email: "ph@test.com", name: "Assuré", role: "POLICYHOLDER" as const, policyholderID: "ph-1" },
};

const mockNotifications = [
  {
    id: "notif-1",
    type: "CLAIM_ASSIGNED",
    title: "Sinistre assigné",
    body: "CLM-2026-00001 vous a été assigné.",
    read: false,
    readAt: null,
    claimId: "claim-1",
    createdAt: new Date("2026-03-01"),
  },
  {
    id: "notif-2",
    type: "FRAUD_ALERT",
    title: "Alerte fraude",
    body: "Score élevé détecté.",
    read: true,
    readAt: new Date("2026-03-02"),
    claimId: "claim-2",
    createdAt: new Date("2026-03-02"),
  },
];

// ─── GET /api/notifications ───────────────────────────────────────────────────

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.notification.findMany).mockResolvedValue(
      mockNotifications as ReturnType<typeof prisma.notification.findMany> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.notification.count).mockResolvedValue(1);
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/notifications"));
    expect(res.status).toBe(401);
  });

  it("retourne 403 si POLICYHOLDER", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const res = await GET(new NextRequest("http://localhost/api/notifications"));
    expect(res.status).toBe(403);
  });

  it("retourne la liste des notifications avec unreadCount", async () => {
    const res = await GET(new NextRequest("http://localhost/api/notifications"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data).toHaveProperty("unreadCount");
    expect(data).toHaveProperty("nextCursor");
  });

  it("filtre par read=false", async () => {
    const res = await GET(new NextRequest("http://localhost/api/notifications?read=false"));
    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ read: false }) })
    );
  });

  it("filtre par read=true", async () => {
    const res = await GET(new NextRequest("http://localhost/api/notifications?read=true"));
    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ read: true }) })
    );
  });

  it("limite à 20 par défaut", async () => {
    const res = await GET(new NextRequest("http://localhost/api/notifications"));
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
    expect(res.status).toBe(200);
  });

  it("retourne 400 pour un limit invalide (> 50)", async () => {
    const res = await GET(new NextRequest("http://localhost/api/notifications?limit=100"));
    expect(res.status).toBe(400);
  });

  it("filtre par userId de la session uniquement", async () => {
    const res = await GET(new NextRequest("http://localhost/api/notifications"));
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) })
    );
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/notifications/unread-count ─────────────────────────────────────

describe("GET /api/notifications/unread-count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.notification.count).mockResolvedValue(3);
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await getUnreadCount();
    expect(res.status).toBe(401);
  });

  it("retourne 0 pour POLICYHOLDER sans erreur", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const res = await getUnreadCount();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
  });

  it("retourne le nombre de notifications non lues", async () => {
    const res = await getUnreadCount();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(3);
  });

  it("ajoute Cache-Control: no-store", async () => {
    const res = await getUnreadCount();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────

describe("PATCH /api/notifications/read-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockManagerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 5 });
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await patchReadAll();
    expect(res.status).toBe(401);
  });

  it("retourne 403 si POLICYHOLDER", async () => {
    vi.mocked(auth).mockResolvedValue(
      mockPolicyholderSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    const res = await patchReadAll();
    expect(res.status).toBe(403);
  });

  it("marque toutes les notifications non lues comme lues", async () => {
    const res = await patchReadAll();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated).toBe(5);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-2", read: false },
        data: expect.objectContaining({ read: true }),
      })
    );
  });
});

// ─── PATCH /api/notifications/[id]/read ──────────────────────────────────────

describe("PATCH /api/notifications/[id]/read", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });
  const makeRequest = (id: string) =>
    new NextRequest(`http://localhost/api/notifications/${id}/read`, { method: "PATCH" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(
      mockHandlerSession as ReturnType<typeof auth> extends Promise<infer T> ? T : never
    );
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "notif-1",
      userId: "user-1",
      read: false,
      readAt: null,
    } as ReturnType<typeof prisma.notification.findUnique> extends Promise<infer T> ? T : never);
    vi.mocked(prisma.notification.update).mockResolvedValue({
      id: "notif-1",
      userId: "user-1",
      read: true,
      readAt: new Date(),
    } as ReturnType<typeof prisma.notification.update> extends Promise<infer T> ? T : never);
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await patchRead(makeRequest("notif-1"), makeParams("notif-1"));
    expect(res.status).toBe(401);
  });

  it("retourne 404 si notification inexistante", async () => {
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);
    const res = await patchRead(makeRequest("unknown"), makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("retourne 403 si notification appartient à un autre utilisateur", async () => {
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "notif-1",
      userId: "autre-user",
      read: false,
      readAt: null,
    } as ReturnType<typeof prisma.notification.findUnique> extends Promise<infer T> ? T : never);
    const res = await patchRead(makeRequest("notif-1"), makeParams("notif-1"));
    expect(res.status).toBe(403);
  });

  it("marque la notification comme lue et crée un audit log", async () => {
    const { createAuditLog } = await import("@/lib/audit");
    const res = await patchRead(makeRequest("notif-1"), makeParams("notif-1"));
    expect(res.status).toBe(200);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ read: true }) })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "NOTIFICATION_READ" })
    );
  });
});
