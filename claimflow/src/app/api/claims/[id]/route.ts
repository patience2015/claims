import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UpdateClaimSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

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

  const existing = await prisma.claim.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });

  // Handlers can only edit their own claims
  if (session.user.role === "HANDLER" && existing.assignedToID !== session.user.id && existing.createdByID !== session.user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { thirdPartyInfo, ...updateData } = parsed.data;
  const claim = await prisma.claim.update({
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
    entityId: claim.id,
    before: existing,
    after: updateData,
    claimId: claim.id,
    userId: session.user.id,
  });

  return NextResponse.json({ data: claim });
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
