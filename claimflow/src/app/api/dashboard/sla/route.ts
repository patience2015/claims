import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SlaOverdueClaim, SlaReport, UserRole } from "@/types";

const SLA_OVERDUE_DAYS = 30;
const SLA_AT_RISK_DAYS = 20;

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const atRiskCutoff = new Date();
  atRiskCutoff.setDate(atRiskCutoff.getDate() - SLA_AT_RISK_DAYS);

  const staleClaims = await prisma.claim.findMany({
    where: { status: "UNDER_REVIEW", updatedAt: { lte: atRiskCutoff } },
    select: {
      id: true,
      claimNumber: true,
      updatedAt: true,
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      policyholder: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  const overdue: SlaOverdueClaim[] = [];
  const atRisk: SlaOverdueClaim[] = [];

  for (const claim of staleClaims) {
    const days = daysSince(claim.updatedAt);
    const shaped: SlaOverdueClaim = {
      id: claim.id,
      claimNumber: claim.claimNumber,
      assignedTo: claim.assignedTo
        ? { id: claim.assignedTo.id, name: claim.assignedTo.name, email: claim.assignedTo.email, role: claim.assignedTo.role as UserRole }
        : null,
      updatedAt: claim.updatedAt.toISOString(),
      daysSinceUpdate: days,
      policyholder: {
        id: claim.policyholder.id,
        firstName: claim.policyholder.firstName,
        lastName: claim.policyholder.lastName,
        email: claim.policyholder.email,
      },
    };
    if (days >= SLA_OVERDUE_DAYS) overdue.push(shaped);
    else atRisk.push(shaped);
  }

  const healthyCount = await prisma.claim.count({
    where: { status: "UNDER_REVIEW", updatedAt: { gt: atRiskCutoff } },
  });

  const report: SlaReport = { overdue, atRisk, healthyCount };
  return NextResponse.json({ data: report });
}
