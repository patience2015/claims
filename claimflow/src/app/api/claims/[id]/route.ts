import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UpdateClaimSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notification-service";

const CLAIM_INCLUDE = {
  policyholder: true,
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  documents: true,
  analyses: { orderBy: { createdAt: "desc" as const }, take: 5 },
  comments: {
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" as const },
  },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const claim = await prisma.claim.findUnique({ where: { id }, include: CLAIM_INCLUDE });
  if (!claim) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });

  // Handlers can only view their own claims
  if (session.user.role === "HANDLER" && claim.assignedToID !== session.user.id && claim.createdByID !== session.user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  return NextResponse.json({ data: claim });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const existingClaim = await prisma.claim.findUnique({ where: { id } });
  if (!existingClaim) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });

  // Handlers can only edit their own claims
  if (session.user.role === "HANDLER" && existingClaim.assignedToID !== session.user.id && existingClaim.createdByID !== session.user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { thirdPartyInfo, ...updateData } = parsed.data;
  // Raw body for checking fields outside UpdateClaimSchema (assignedToID, status)
  const rawBody = body as Record<string, unknown>;
  const updatedClaim = await prisma.claim.update({
    where: { id },
    data: {
      ...updateData,
      ...(thirdPartyInfo !== undefined ? { thirdPartyInfo: JSON.stringify(thirdPartyInfo) } : {}),
    },
    include: CLAIM_INCLUDE,
  });

  await createAuditLog({
    action: "CLAIM_UPDATED",
    entityType: "CLAIM",
    entityId: updatedClaim.id,
    before: existingClaim,
    after: updateData,
    claimId: updatedClaim.id,
    userId: session.user.id,
  });

  // Notification in-app gestionnaire assigné
  const newAssignedToID = typeof rawBody.assignedToID === "string" ? rawBody.assignedToID : null;
  if (newAssignedToID && newAssignedToID !== existingClaim.assignedToID) {
    void createNotification({
      userId: newAssignedToID,
      type: "CLAIM_ASSIGNED",
      title: `Sinistre assigné — ${existingClaim.claimNumber}`,
      body: `Le sinistre ${existingClaim.claimNumber} vous a été assigné.`,
      claimId: existingClaim.id,
    }).catch(console.error);
  }
  // Notification changement statut
  const newStatus = typeof rawBody.status === "string" ? rawBody.status : null;
  if (newStatus && newStatus !== existingClaim.status && existingClaim.assignedToID) {
    void createNotification({
      userId: existingClaim.assignedToID,
      type: "STATUS_CHANGED",
      title: `Statut modifié — ${existingClaim.claimNumber}`,
      body: `Le sinistre ${existingClaim.claimNumber} est passé à ${newStatus}.`,
      claimId: existingClaim.id,
    }).catch(console.error);
  }
  // Notification fraude élevée
  if (updatedClaim.fraudScore && updatedClaim.fraudScore > 70) {
    const managers = await prisma.user.findMany({ where: { role: { in: ["MANAGER", "ADMIN"] }, active: true }, select: { id: true } });
    for (const mgr of managers) {
      void createNotification({
        userId: mgr.id,
        type: "FRAUD_ALERT",
        title: `Alerte fraude — ${existingClaim.claimNumber}`,
        body: `Score de fraude élevé (${updatedClaim.fraudScore}/100) détecté sur ${existingClaim.claimNumber}.`,
        claimId: existingClaim.id,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ data: updatedClaim });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });

  await createAuditLog({
    action: "CLAIM_DELETED",
    entityType: "CLAIM",
    entityId: id,
    before: claim,
    claimId: id,
    userId: session.user.id,
  });

  await prisma.claim.delete({ where: { id } });

  return NextResponse.json({ message: "Sinistre supprimé" });
}
