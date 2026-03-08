import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { RecomputeSchema } from "@/lib/validations";
import { recomputeFraudNetworks } from "@/lib/fraud-network-service";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Accès refusé — ADMIN requis" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = RecomputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const result = await recomputeFraudNetworks(parsed.data.scope);

  await createAuditLog({
    action: "NETWORK_RECOMPUTED",
    entityType: "FRAUD_NETWORK",
    entityId: "global",
    after: result,
    userId: session.user.id,
  });

  return NextResponse.json({ message: "Recalcul terminé", ...result }, { status: 202 });
}
