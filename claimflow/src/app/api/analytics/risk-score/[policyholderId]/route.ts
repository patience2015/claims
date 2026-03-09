import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeRiskScore } from "@/lib/risk-scoring-service";
import { checkAndSendRiskAlert } from "@/lib/risk-alert-service";
import { z } from "zod";
import type { RiskLevel } from "@/types";

const QuerySchema = z.object({ force: z.coerce.boolean().default(false) });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ policyholderId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { policyholderId } = await params;
  const role = session.user.role as string;

  // POLICYHOLDER peut uniquement consulter son propre score
  if (role === "POLICYHOLDER") {
    const ph = await prisma.policyholder.findFirst({ where: { userId: session.user.id as string } });
    if (!ph || ph.id !== policyholderId) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
  } else if (!["HANDLER", "MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const parsed = QuerySchema.safeParse({ force: req.nextUrl.searchParams.get("force") });
  const forceRefresh = parsed.success ? parsed.data.force : false;

  const policyholder = await prisma.policyholder.findUnique({ where: { id: policyholderId } });
  if (!policyholder) return NextResponse.json({ error: "Assuré introuvable" }, { status: 404 });

  // Capturer le niveau précédent pour détecter les changements
  const prevScore = await prisma.riskScore.findFirst({
    where: { policyholderId },
    orderBy: { computedAt: "desc" },
  });
  const previousLevel = (prevScore?.riskLevel as RiskLevel) ?? null;

  const result = await computeRiskScore(policyholderId, { forceRefresh, userId: session.user.id as string });

  // Déclencher alerte si le niveau a changé
  if (!result.fromCache && previousLevel !== result.riskLevel) {
    await checkAndSendRiskAlert({
      policyholderId,
      previousLevel,
      newLevel: result.riskLevel,
      scoreGlobal: result.scoreGlobal,
      policyholderEmail: policyholder.email,
      policyholderName: `${policyholder.firstName} ${policyholder.lastName}`,
      contractStatus: result.contractStatus,
    });
  }

  return NextResponse.json({ data: result });
}
