import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const visibilityWhere = session.user.role === "HANDLER"
    ? { OR: [{ assignedToID: session.user.id }, { createdByID: session.user.id }] }
    : {};

  const [recentClaims, recentAuditLogs] = await Promise.all([
    prisma.claim.findMany({
      where: visibilityWhere,
      include: {
        policyholder: true,
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      where: session.user.role === "HANDLER" ? { userId: session.user.id } : {},
      include: {
        user: { select: { id: true, name: true, role: true } },
        claim: { select: { id: true, claimNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({ data: { recentClaims, recentAuditLogs } });
}
