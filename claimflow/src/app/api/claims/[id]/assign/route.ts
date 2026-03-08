import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AssignClaimSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notification-service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role === "HANDLER") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = AssignClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });

  const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!targetUser || !targetUser.active) {
    return NextResponse.json({ error: "Utilisateur introuvable ou inactif" }, { status: 404 });
  }

  const updated = await prisma.claim.update({
    where: { id },
    data: {
      assignedToID: parsed.data.userId,
      status: claim.status === "SUBMITTED" ? "UNDER_REVIEW" : claim.status,
    },
    include: {
      policyholder: true,
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  await createAuditLog({
    action: "CLAIM_ASSIGNED",
    entityType: "CLAIM",
    entityId: claim.id,
    before: { assignedToID: claim.assignedToID },
    after: { assignedToID: parsed.data.userId, assignedTo: targetUser.name },
    claimId: claim.id,
    userId: session.user.id,
  });

  await createNotification({
    userId: parsed.data.userId,
    type: "CLAIM_ASSIGNED",
    title: `Sinistre assigné — ${claim.claimNumber}`,
    body: `Le sinistre ${claim.claimNumber} vous a été assigné par ${session.user.name}.`,
    claimId: claim.id,
  });

  return NextResponse.json({ data: updated });
}
