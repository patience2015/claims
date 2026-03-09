import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { computeAllRiskScores } from "@/lib/risk-scoring-service";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const BodySchema = z.object({ scope: z.enum(["ALL", "STALE_ONLY"]).default("STALE_ONLY") });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Réservé aux ADMIN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });

  const result = await computeAllRiskScores(parsed.data.scope);

  await createAuditLog({
    action: "RISK_SCORE_COMPUTED",
    entityType: "POLICYHOLDER",
    entityId: "global",
    after: result,
    userId: session.user.id as string,
  });

  return NextResponse.json({ data: result }, { status: 202 });
}
