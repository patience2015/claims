import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BulkAssignSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notification-service";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = BulkAssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const { claimIds, assignToId } = parsed.data;

  const targetUser = await prisma.user.findUnique({
    where: { id: assignToId },
    select: { id: true, name: true, active: true },
  });
  if (!targetUser || !targetUser.active) {
    return NextResponse.json({ error: "Utilisateur cible introuvable ou inactif" }, { status: 404 });
  }

  const existingClaims = await prisma.claim.findMany({
    where: { id: { in: claimIds } },
    select: { id: true, claimNumber: true, assignedToID: true, status: true },
  });
  if (existingClaims.length === 0) {
    return NextResponse.json({ error: "Aucun sinistre trouvé" }, { status: 404 });
  }

  const updatedClaims = await prisma.$transaction(
    existingClaims.map((claim) =>
      prisma.claim.update({
        where: { id: claim.id },
        data: {
          assignedToID: assignToId,
          status: claim.status === "SUBMITTED" ? "UNDER_REVIEW" : claim.status,
        },
        select: {
          id: true,
          claimNumber: true,
          status: true,
          assignedToID: true,
          assignedTo: { select: { id: true, name: true, email: true, role: true } },
          updatedAt: true,
        },
      }),
    ),
  );

  await Promise.all(
    existingClaims.map((claim) =>
      createAuditLog({
        action: "CLAIM_ASSIGNED",
        entityType: "CLAIM",
        entityId: claim.id,
        before: { assignedToID: claim.assignedToID },
        after: { assignedToID: assignToId, assignedTo: targetUser.name },
        claimId: claim.id,
        userId: session.user.id,
      }),
    ),
  );

  await createNotification({
    userId: assignToId,
    type: "CLAIM_ASSIGNED",
    title: `${updatedClaims.length} sinistre(s) assigné(s)`,
    body: `${updatedClaims.length} sinistre(s) vous ont été assignés par ${session.user.name}.`,
    claimId: updatedClaims[0]?.id ?? undefined,
  });

  return NextResponse.json({ data: { updated: updatedClaims.length, claims: updatedClaims } }, { status: 201 });
}
