import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TeamDashboardQuerySchema } from "@/lib/validations";
import type { TeamMemberStats, UserRole } from "@/types";

const PENDING_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"] as const;
const SLA_BREACH_DAYS = 30;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const parsed = TeamDashboardQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const { period } = parsed.data;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const slaBreachCutoff = new Date();
  slaBreachCutoff.setDate(slaBreachCutoff.getDate() - SLA_BREACH_DAYS);

  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["HANDLER", "MANAGER"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      assignedClaims: {
        where: { createdAt: { gte: startDate } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const result: TeamMemberStats[] = users.map((user) => {
    const claims = user.assignedClaims;
    const total = claims.length;
    const pending = claims.filter((c) => (PENDING_STATUSES as readonly string[]).includes(c.status)).length;
    const slaBreached = claims.filter(
      (c) => c.status === "UNDER_REVIEW" && c.updatedAt < slaBreachCutoff,
    ).length;

    const closedClaims = claims.filter((c) => ["APPROVED", "REJECTED", "CLOSED"].includes(c.status));
    const avgProcessingDays =
      closedClaims.length > 0
        ? Math.round(
            closedClaims.reduce((sum, c) => {
              return sum + (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            }, 0) / closedClaims.length,
          )
        : 0;

    const approvedCount = claims.filter((c) => c.status === "APPROVED").length;
    const approvalRate = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      stats: { total, pending, slaBreached, avgProcessingDays, approvalRate },
    };
  });

  return NextResponse.json({ data: result });
}
