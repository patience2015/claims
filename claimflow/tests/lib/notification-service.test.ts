/**
 * Tests — src/lib/notification-service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./prisma", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationPreference: {
      findUnique: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    claim: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

import { createNotification, checkSLABreaches } from "@/lib/notification-service";
import { prisma } from "@/lib/prisma";

const makeNotif = (overrides = {}) => ({
  id: "notif-1",
  userId: "user-1",
  type: "CLAIM_ASSIGNED" as const,
  title: "Test",
  body: "Test body",
  read: false,
  readAt: null,
  claimId: null,
  createdAt: new Date(),
  ...overrides,
});

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.notification.create).mockResolvedValue(
      makeNotif() as ReturnType<typeof prisma.notification.create> extends Promise<infer T> ? T : never
    );
  });

  it("creates notification when no preference set", async () => {
    const result = await createNotification({
      userId: "user-1",
      type: "CLAIM_ASSIGNED",
      title: "Test",
      body: "Body",
    });
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("returns null when inAppEnabled is false in preferences", async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      id: "pref-1",
      userId: "user-1",
      type: "CLAIM_ASSIGNED",
      inAppEnabled: false,
      emailEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ReturnType<typeof prisma.notificationPreference.findUnique> extends Promise<infer T> ? T : never);
    const result = await createNotification({
      userId: "user-1",
      type: "CLAIM_ASSIGNED",
      title: "Test",
      body: "Body",
    });
    expect(result).toBeNull();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("creates notification when inAppEnabled is true", async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      id: "pref-1",
      userId: "user-1",
      type: "CLAIM_ASSIGNED",
      inAppEnabled: true,
      emailEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ReturnType<typeof prisma.notificationPreference.findUnique> extends Promise<infer T> ? T : never);
    const result = await createNotification({
      userId: "user-1",
      type: "CLAIM_ASSIGNED",
      title: "Test",
      body: "Body",
    });
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("deduplicates FRAUD_ALERT notifications for same claim", async () => {
    const existingNotif = makeNotif({ type: "FRAUD_ALERT", claimId: "claim-1" });
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(
      existingNotif as ReturnType<typeof prisma.notification.findFirst> extends Promise<infer T> ? T : never
    );
    const result = await createNotification({
      userId: "user-1",
      type: "FRAUD_ALERT",
      title: "Alert",
      body: "Body",
      claimId: "claim-1",
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(result).toEqual(existingNotif);
  });

  it("creates new FRAUD_ALERT when no existing one", async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null);
    await createNotification({
      userId: "user-1",
      type: "FRAUD_ALERT",
      title: "Alert",
      body: "Body",
      claimId: "claim-1",
    });
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it("deduplicates SLA_BREACH notifications within 7 days", async () => {
    const existingNotif = makeNotif({ type: "SLA_BREACH", claimId: "claim-1" });
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(
      existingNotif as ReturnType<typeof prisma.notification.findFirst> extends Promise<infer T> ? T : never
    );
    const result = await createNotification({
      userId: "user-1",
      type: "SLA_BREACH",
      title: "SLA",
      body: "Body",
      claimId: "claim-1",
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(result).toEqual(existingNotif);
  });

  it("creates new SLA_BREACH when no existing recent one", async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null);
    await createNotification({
      userId: "user-1",
      type: "SLA_BREACH",
      title: "SLA",
      body: "Body",
      claimId: "claim-1",
    });
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it("passes claimId to creation", async () => {
    await createNotification({
      userId: "user-1",
      type: "STATUS_CHANGED",
      title: "Status",
      body: "Body",
      claimId: "claim-1",
    });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ claimId: "claim-1" }),
      })
    );
  });
});

describe("checkSLABreaches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.notification.create).mockResolvedValue(
      makeNotif({ type: "SLA_BREACH", createdAt: new Date() }) as ReturnType<typeof prisma.notification.create> extends Promise<infer T> ? T : never
    );
  });

  it("returns checked=0 and created=0 when no overdue claims", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    const result = await checkSLABreaches();
    expect(result.checked).toBe(0);
    expect(result.created).toBe(0);
  });

  it("checks overdue claims and notifies managers", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      { id: "claim-1", claimNumber: "CLM-2026-00001", updatedAt: new Date("2026-01-01") },
    ] as ReturnType<typeof prisma.claim.findMany> extends Promise<infer T> ? T : never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "manager-1" },
    ] as ReturnType<typeof prisma.user.findMany> extends Promise<infer T> ? T : never);
    const result = await checkSLABreaches();
    expect(result.checked).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "SLA_BREACH",
          claimId: "claim-1",
          userId: "manager-1",
        }),
      })
    );
  });

  it("skips creation when notification deduplicated", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      { id: "claim-1", claimNumber: "CLM-2026-00001", updatedAt: new Date("2026-01-01") },
    ] as ReturnType<typeof prisma.claim.findMany> extends Promise<infer T> ? T : never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "manager-1" },
    ] as ReturnType<typeof prisma.user.findMany> extends Promise<infer T> ? T : never);
    // Simulate existing SLA_BREACH (deduplicated)
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(
      makeNotif({ type: "SLA_BREACH", claimId: "claim-1" }) as ReturnType<typeof prisma.notification.findFirst> extends Promise<infer T> ? T : never
    );
    const result = await checkSLABreaches();
    expect(result.checked).toBe(1);
  });
});
