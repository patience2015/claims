/**
 * Tests — src/lib/validations.ts
 */
import { describe, it, expect } from "vitest";
import {
  CreateClaimSchema,
  UpdateClaimSchema,
  ClaimStatusSchema,
  AssignClaimSchema,
  CreatePolicyholderSchema,
  CreateCommentSchema,
  CreateUserSchema,
  UpdateUserSchema,
  PortailDecisionSchema,
  ClaimQuerySchema,
  DashboardPeriodSchema,
} from "@/lib/validations";

const validClaim = {
  type: "COLLISION" as const,
  description: "Accrochage au carrefour de la rue principale",
  incidentDate: "2026-01-15",
  incidentLocation: "Paris, France",
  thirdPartyInvolved: false,
  policyholderID: "cjld2cyuq0000t3rmniod1foy",
};

describe("CreateClaimSchema", () => {
  it("accepts valid claim", () => {
    const result = CreateClaimSchema.safeParse(validClaim);
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = CreateClaimSchema.safeParse({ ...validClaim, type: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects short description", () => {
    const result = CreateClaimSchema.safeParse({ ...validClaim, description: "court" });
    expect(result.success).toBe(false);
  });

  it("rejects short incidentLocation", () => {
    const result = CreateClaimSchema.safeParse({ ...validClaim, incidentLocation: "ok" });
    expect(result.success).toBe(false);
  });

  it("accepts ISO datetime for incidentDate", () => {
    const result = CreateClaimSchema.safeParse({
      ...validClaim,
      incidentDate: "2026-01-15T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional thirdPartyInfo", () => {
    const result = CreateClaimSchema.safeParse({
      ...validClaim,
      thirdPartyInvolved: true,
      thirdPartyInfo: { name: "Jean Dupont", plate: "AB-123-CD" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid policyholderID (not cuid)", () => {
    const result = CreateClaimSchema.safeParse({ ...validClaim, policyholderID: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("defaults thirdPartyInvolved to false", () => {
    const { thirdPartyInvolved: _, ...withoutTP } = validClaim;
    const result = CreateClaimSchema.safeParse(withoutTP);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thirdPartyInvolved).toBe(false);
    }
  });
});

describe("UpdateClaimSchema", () => {
  it("accepts partial data", () => {
    const result = UpdateClaimSchema.safeParse({ description: "Nouvelle description longue" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = UpdateClaimSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("ClaimStatusSchema", () => {
  it("accepts valid status", () => {
    const result = ClaimStatusSchema.safeParse({ status: "APPROVED" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = ClaimStatusSchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepts optional reason and approvedAmount", () => {
    const result = ClaimStatusSchema.safeParse({
      status: "APPROVED",
      reason: "Dossier complet",
      approvedAmount: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative approvedAmount", () => {
    const result = ClaimStatusSchema.safeParse({ status: "APPROVED", approvedAmount: -100 });
    expect(result.success).toBe(false);
  });
});

describe("AssignClaimSchema", () => {
  it("accepts valid cuid", () => {
    const result = AssignClaimSchema.safeParse({ userId: "cjld2cyuq0000t3rmniod1foy" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid userId", () => {
    const result = AssignClaimSchema.safeParse({ userId: "not-valid" });
    expect(result.success).toBe(false);
  });
});

describe("CreatePolicyholderSchema", () => {
  const validPH = {
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
    coverageType: "ALL_RISKS" as const,
  };

  it("accepts valid policyholder", () => {
    const result = CreatePolicyholderSchema.safeParse(validPH);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = CreatePolicyholderSchema.safeParse({ ...validPH, email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid coverageType", () => {
    const result = CreatePolicyholderSchema.safeParse({ ...validPH, coverageType: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects old vehicleYear (< 1990)", () => {
    const result = CreatePolicyholderSchema.safeParse({ ...validPH, vehicleYear: 1985 });
    expect(result.success).toBe(false);
  });

  it("accepts optional vehicleVin", () => {
    const result = CreatePolicyholderSchema.safeParse({ ...validPH, vehicleVin: "1HGCM82633A004352" });
    expect(result.success).toBe(true);
  });
});

describe("CreateCommentSchema", () => {
  it("accepts valid comment", () => {
    const result = CreateCommentSchema.safeParse({ content: "Bon dossier" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = CreateCommentSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("defaults isInternal to true", () => {
    const result = CreateCommentSchema.safeParse({ content: "ok" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isInternal).toBe(true);
  });
});

describe("CreateUserSchema", () => {
  it("accepts valid user", () => {
    const result = CreateUserSchema.safeParse({
      email: "user@example.com",
      name: "Alice",
      password: "password123",
      role: "HANDLER",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = CreateUserSchema.safeParse({
      email: "user@example.com",
      name: "Alice",
      password: "short",
      role: "HANDLER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = CreateUserSchema.safeParse({
      email: "user@example.com",
      name: "Alice",
      password: "password123",
      role: "POLICYHOLDER",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateUserSchema", () => {
  it("accepts partial update", () => {
    const result = UpdateUserSchema.safeParse({ name: "Bob" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = UpdateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts active flag", () => {
    const result = UpdateUserSchema.safeParse({ active: false });
    expect(result.success).toBe(true);
  });
});

describe("PortailDecisionSchema", () => {
  it("accepts ACCEPT without reason", () => {
    const result = PortailDecisionSchema.safeParse({ decision: "ACCEPT" });
    expect(result.success).toBe(true);
  });

  it("accepts REJECT with sufficient reason", () => {
    const result = PortailDecisionSchema.safeParse({
      decision: "REJECT",
      reason: "Je refuse car le montant proposé est insuffisant.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects REJECT with no reason", () => {
    const result = PortailDecisionSchema.safeParse({ decision: "REJECT" });
    expect(result.success).toBe(false);
  });

  it("rejects REJECT with too short reason (< 20 chars)", () => {
    const result = PortailDecisionSchema.safeParse({ decision: "REJECT", reason: "trop court" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid decision", () => {
    const result = PortailDecisionSchema.safeParse({ decision: "MAYBE" });
    expect(result.success).toBe(false);
  });
});

describe("ClaimQuerySchema", () => {
  it("defaults page to 1 and pageSize to 20", () => {
    const result = ClaimQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("accepts valid page and pageSize", () => {
    const result = ClaimQuerySchema.safeParse({ page: "2", pageSize: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("accepts valid status filter", () => {
    const result = ClaimQuerySchema.safeParse({ status: "SUBMITTED" });
    expect(result.success).toBe(true);
  });

  it("accepts valid type filter", () => {
    const result = ClaimQuerySchema.safeParse({ type: "COLLISION" });
    expect(result.success).toBe(true);
  });

  it("coerces invalid page to 1", () => {
    const result = ClaimQuerySchema.safeParse({ page: "abc" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(1);
  });
});

describe("DashboardPeriodSchema", () => {
  it("defaults period to 30d", () => {
    const result = DashboardPeriodSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.period).toBe("30d");
  });

  it("accepts 7d period", () => {
    const result = DashboardPeriodSchema.safeParse({ period: "7d" });
    expect(result.success).toBe(true);
  });

  it("accepts custom period with dates", () => {
    const result = DashboardPeriodSchema.safeParse({
      period: "custom",
      dateFrom: "2026-01-01",
      dateTo: "2026-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid period", () => {
    const result = DashboardPeriodSchema.safeParse({ period: "invalid" });
    expect(result.success).toBe(false);
  });
});
