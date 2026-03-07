import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const DecisionSchema = z.union([
  z.object({ decision: z.literal("ACCEPT") }),
  z.object({
    decision: z.literal("REJECT"),
    reason: z.string().min(20, "Motif trop court (min 20 caractères)"),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== "POLICYHOLDER") {
    return NextResponse.json({ error: "Accès réservé aux assurés" }, { status: 403 });
  }

  const { id } = await params;

  const policyholder = await prisma.policyholder.findUnique({
    where: { userId: session.user.id },
  });
  if (!policyholder) {
    return NextResponse.json({ error: "Profil assuré introuvable" }, { status: 404 });
  }

  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });
  if (claim.policyholderID !== policyholder.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (claim.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Aucune décision disponible pour ce sinistre" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { decision } = parsed.data;
  const newStatus = decision === "ACCEPT" ? "CLOSED" : "CLOSED";
  const closureReason =
    decision === "ACCEPT"
      ? "Proposition acceptée par l'assuré"
      : `Proposition refusée par l'assuré : ${"reason" in parsed.data ? parsed.data.reason : ""}`;

  const updated = await prisma.claim.update({
    where: { id },
    data: {
      status: newStatus,
      closureReason,
    },
  });

  await createAuditLog({
    action: "STATUS_CHANGED",
    entityType: "CLAIM",
    entityId: id,
    before: { status: claim.status },
    after: { status: newStatus, closureReason, decisionBy: "POLICYHOLDER", decision },
    claimId: id,
    userId: session.user.id,
  });

  return NextResponse.json({
    data: { id: updated.id, status: updated.status, closureReason: updated.closureReason },
  });
}
