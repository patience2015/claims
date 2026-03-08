/**
 * Tests — src/lib/permissions.ts
 */
import { describe, it, expect } from "vitest";
import { permissions, requireRole, getDefaultRedirect } from "@/lib/permissions";
import { UserRole } from "@/types";

describe("permissions", () => {
  describe("canViewAllClaims", () => {
    it("returns true for MANAGER", () => {
      expect(permissions.canViewAllClaims("MANAGER")).toBe(true);
    });

    it("returns true for ADMIN", () => {
      expect(permissions.canViewAllClaims("ADMIN")).toBe(true);
    });

    it("returns false for HANDLER", () => {
      expect(permissions.canViewAllClaims("HANDLER")).toBe(false);
    });

    it("returns false for POLICYHOLDER", () => {
      expect(permissions.canViewAllClaims("POLICYHOLDER")).toBe(false);
    });
  });

  describe("canCreateClaim", () => {
    it("returns true for any role", () => {
      expect(permissions.canCreateClaim("HANDLER")).toBe(true);
      expect(permissions.canCreateClaim("MANAGER")).toBe(true);
      expect(permissions.canCreateClaim("ADMIN")).toBe(true);
      expect(permissions.canCreateClaim("POLICYHOLDER")).toBe(true);
    });
  });

  describe("canEditClaim", () => {
    it("returns true for MANAGER regardless of ownership", () => {
      expect(permissions.canEditClaim("MANAGER", false)).toBe(true);
    });

    it("returns true for ADMIN regardless of ownership", () => {
      expect(permissions.canEditClaim("ADMIN", false)).toBe(true);
    });

    it("returns true for HANDLER if owner", () => {
      expect(permissions.canEditClaim("HANDLER", true)).toBe(true);
    });

    it("returns false for HANDLER if not owner", () => {
      expect(permissions.canEditClaim("HANDLER", false)).toBe(false);
    });
  });

  describe("canApproveClaim", () => {
    it("returns true for MANAGER", () => {
      expect(permissions.canApproveClaim("MANAGER")).toBe(true);
    });

    it("returns true for ADMIN", () => {
      expect(permissions.canApproveClaim("ADMIN")).toBe(true);
    });

    it("returns false for HANDLER", () => {
      expect(permissions.canApproveClaim("HANDLER")).toBe(false);
    });
  });

  describe("canRejectClaim", () => {
    it("returns true for MANAGER and ADMIN", () => {
      expect(permissions.canRejectClaim("MANAGER")).toBe(true);
      expect(permissions.canRejectClaim("ADMIN")).toBe(true);
    });

    it("returns false for HANDLER", () => {
      expect(permissions.canRejectClaim("HANDLER")).toBe(false);
    });
  });

  describe("canAssignClaim", () => {
    it("returns true for MANAGER and ADMIN", () => {
      expect(permissions.canAssignClaim("MANAGER")).toBe(true);
      expect(permissions.canAssignClaim("ADMIN")).toBe(true);
    });

    it("returns false for HANDLER", () => {
      expect(permissions.canAssignClaim("HANDLER")).toBe(false);
    });
  });

  describe("canDeleteClaim", () => {
    it("returns true only for ADMIN", () => {
      expect(permissions.canDeleteClaim("ADMIN")).toBe(true);
    });

    it("returns false for MANAGER", () => {
      expect(permissions.canDeleteClaim("MANAGER")).toBe(false);
    });

    it("returns false for HANDLER", () => {
      expect(permissions.canDeleteClaim("HANDLER")).toBe(false);
    });
  });

  describe("canRunAI", () => {
    it("returns true for any role", () => {
      expect(permissions.canRunAI("HANDLER")).toBe(true);
      expect(permissions.canRunAI("MANAGER")).toBe(true);
    });
  });

  describe("canViewFullDashboard", () => {
    it("returns true for MANAGER and ADMIN", () => {
      expect(permissions.canViewFullDashboard("MANAGER")).toBe(true);
      expect(permissions.canViewFullDashboard("ADMIN")).toBe(true);
    });

    it("returns false for HANDLER", () => {
      expect(permissions.canViewFullDashboard("HANDLER")).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("returns true only for ADMIN", () => {
      expect(permissions.canManageUsers("ADMIN")).toBe(true);
      expect(permissions.canManageUsers("MANAGER")).toBe(false);
    });
  });

  describe("canViewAuditLogs", () => {
    it("returns true for MANAGER and ADMIN", () => {
      expect(permissions.canViewAuditLogs("MANAGER")).toBe(true);
      expect(permissions.canViewAuditLogs("ADMIN")).toBe(true);
    });

    it("returns false for HANDLER", () => {
      expect(permissions.canViewAuditLogs("HANDLER")).toBe(false);
    });
  });

  describe("canExportAuditLogs", () => {
    it("returns true only for ADMIN", () => {
      expect(permissions.canExportAuditLogs("ADMIN")).toBe(true);
      expect(permissions.canExportAuditLogs("MANAGER")).toBe(false);
    });
  });
});

describe("requireRole", () => {
  it("returns true if role is in allowedRoles", () => {
    expect(requireRole("MANAGER", "MANAGER", "ADMIN")).toBe(true);
  });

  it("returns false if role is not in allowedRoles", () => {
    expect(requireRole("HANDLER", "MANAGER", "ADMIN")).toBe(false);
  });

  it("returns true for single allowed role match", () => {
    expect(requireRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("returns false if no allowed roles", () => {
    expect(requireRole("ADMIN")).toBe(false);
  });
});

describe("getDefaultRedirect", () => {
  it("redirects HANDLER to /claims", () => {
    expect(getDefaultRedirect("HANDLER")).toBe("/claims");
  });

  it("redirects MANAGER to /dashboard", () => {
    expect(getDefaultRedirect("MANAGER")).toBe("/dashboard");
  });

  it("redirects ADMIN to /admin", () => {
    expect(getDefaultRedirect("ADMIN")).toBe("/admin");
  });

  it("redirects POLICYHOLDER to /portail/mes-sinistres", () => {
    expect(getDefaultRedirect("POLICYHOLDER")).toBe("/portail/mes-sinistres");
  });

  it("defaults to /claims for unknown role", () => {
    expect(getDefaultRedirect("UNKNOWN" as UserRole)).toBe("/claims");
  });
});
