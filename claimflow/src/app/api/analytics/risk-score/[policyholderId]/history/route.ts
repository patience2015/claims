import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const QuerySchema = z.object({ limit: z.coerce.number().min(1).max(90).default(30) });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ policyholderId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as string;
  if (!["POLICYHOLDER", "HANDLER", "MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { policyholderId } = await params;

  // POLICYHOLDER ne peut consulter que son propre historique
  if (role === "POLICYHOLDER") {
    const ph = await prisma.policyholder.findFirst({ where: { userId: session.user.id as string } });
    if (!ph || ph.id !== policyholderId) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
  }
  const parsed = QuerySchema.safeParse({ limit: req.nextUrl.searchParams.get("limit") });
  const limit = parsed.success ? parsed.data.limit : 30;

  const history = await prisma.riskScore.findMany({
    where: { policyholderId },
    orderBy: { computedAt: "desc" },
    take: limit,
    select: {
      id: true,
      scoreGlobal: true,
      riskLevel: true,
      factorHistorique: true,
      factorProfil: true,
      factorZone: true,
      factorPeriode: true,
      factorMeteo: true,
      computedAt: true,
    },
  });

  return NextResponse.json({
    data: history.map((h) => ({ ...h, computedAt: h.computedAt.toISOString() })),
  });
}
