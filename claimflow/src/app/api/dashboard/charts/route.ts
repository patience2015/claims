import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") || "30d";
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const visibilityWhere = session.user.role === "HANDLER"
    ? { OR: [{ assignedToID: session.user.id }, { createdByID: session.user.id }] }
    : {};

  const claims = await prisma.claim.findMany({
    where: { ...visibilityWhere, createdAt: { gte: startDate } },
    select: { createdAt: true, type: true, estimatedAmount: true, status: true },
  });

  // Group by date for timeline
  const timelineMap = new Map<string, { count: number; amount: number }>();
  for (const claim of claims) {
    const date = claim.createdAt.toISOString().split("T")[0];
    const existing = timelineMap.get(date) || { count: 0, amount: 0 };
    timelineMap.set(date, {
      count: existing.count + 1,
      amount: existing.amount + (claim.estimatedAmount || 0),
    });
  }

  const timeline = Array.from(timelineMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Group by type for distribution
  const typeMap = new Map<string, number>();
  for (const claim of claims) {
    typeMap.set(claim.type, (typeMap.get(claim.type) || 0) + 1);
  }

  const typeDistribution = Array.from(typeMap.entries()).map(([type, count]) => ({
    type,
    count,
    percentage: Math.round((count / claims.length) * 100),
  }));

  return NextResponse.json({ data: { timeline, typeDistribution } });
}
