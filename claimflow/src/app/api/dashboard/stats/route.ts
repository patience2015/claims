import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardPeriodSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const parsed = DashboardPeriodSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const { period, dateFrom, dateTo } = parsed.data;

  let startDate: Date;
  const endDate = dateTo ? new Date(dateTo) : new Date();

  if (period === "custom" && dateFrom) {
    startDate = new Date(dateFrom);
  } else {
    startDate = new Date();
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    startDate.setDate(startDate.getDate() - days);
  }

  // Build where clause for role-based visibility
  const visibilityWhere = session.user.role === "HANDLER"
    ? { OR: [{ assignedToID: session.user.id }, { createdByID: session.user.id }] }
    : {};

  const dateWhere = { createdAt: { gte: startDate, lte: endDate } };
  const where = { ...visibilityWhere, ...dateWhere };

  const [
    totalClaims,
    claimsByStatus,
    fraudClaims,
    estimatedAmounts,
  ] = await Promise.all([
    prisma.claim.count({ where }),
    prisma.claim.groupBy({ by: ["status"], where, _count: { id: true } }),
    prisma.claim.count({ where: { ...where, fraudScore: { gt: 70 } } }),
    prisma.claim.aggregate({ where: { ...where, estimatedAmount: { not: null } }, _sum: { estimatedAmount: true } }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const item of claimsByStatus) {
    statusMap[item.status] = item._count.id;
  }

  const pendingStatuses = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"];
  const pendingClaims = pendingStatuses.reduce((sum, s) => sum + (statusMap[s] || 0), 0);

  return NextResponse.json({
    data: {
      totalClaims,
      claimsByStatus: statusMap,
      totalEstimatedAmount: estimatedAmounts._sum.estimatedAmount || 0,
      fraudRate: totalClaims > 0 ? Math.round((fraudClaims / totalClaims) * 100) : 0,
      pendingClaims,
      period: { startDate, endDate },
    },
  });
}
