import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FraudNetworkActionSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const network = await prisma.fraudNetwork.findUnique({
    where: { id },
    include: {
      links: { where: { stale: false } },
      audits: { orderBy: { createdAt: "desc" }, take: 10 },
      claims: {
        select: {
          id: true,
          claimNumber: true,
          status: true,
          fraudScore: true,
          networkScore: true,
        },
      },
    },
  });

  if (!network) return NextResponse.json({ error: "Réseau introuvable" }, { status: 404 });

  const nodes = JSON.parse(network.nodesJson || "[]");
  return NextResponse.json({ data: { ...network, nodes } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = FraudNetworkActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const network = await prisma.fraudNetwork.findUnique({
    where: { id },
    include: { claims: { select: { id: true, status: true } } },
  });
  if (!network) return NextResponse.json({ error: "Réseau introuvable" }, { status: 404 });

  const { action, reason, notes } = parsed.data;

  if (action === "DISMISS") {
    const updated = await prisma.fraudNetwork.update({
      where: { id },
      data: {
        status: "DISMISSED",
        notes: notes ?? network.notes,
        version: { increment: 1 },
      },
    });
    // Reset networkScore on associated claims
    await prisma.claim.updateMany({
      where: { networkId: id },
      data: { networkScore: 0, networkRisk: "DISMISSED" },
    });
    await prisma.fraudNetworkAudit.create({
      data: {
        networkId: id,
        action: "NETWORK_DISMISSED",
        before: JSON.stringify({ status: network.status }),
        after: JSON.stringify({ status: "DISMISSED", reason }),
        userId: session.user.id,
      },
    });
    await createAuditLog({
      action: "NETWORK_DISMISSED",
      entityType: "FRAUD_NETWORK",
      entityId: id,
      before: network,
      after: { status: "DISMISSED", reason },
      userId: session.user.id,
    });
    return NextResponse.json({ data: updated });
  }

  if (action === "ESCALATE") {
    const updated = await prisma.fraudNetwork.update({
      where: { id },
      data: {
        status: "UNDER_INVESTIGATION",
        notes: notes ?? network.notes,
        version: { increment: 1 },
      },
    });
    // Move active claims to UNDER_REVIEW
    const activeClaims = network.claims.filter(
      (c) => !["CLOSED", "REJECTED", "APPROVED"].includes(c.status)
    );
    for (const claim of activeClaims) {
      await prisma.claim.update({
        where: { id: claim.id },
        data: { status: "UNDER_REVIEW" },
      });
    }
    await prisma.fraudNetworkAudit.create({
      data: {
        networkId: id,
        action: "NETWORK_ESCALATED",
        before: JSON.stringify({ status: network.status }),
        after: JSON.stringify({ status: "UNDER_INVESTIGATION", notes }),
        userId: session.user.id,
      },
    });
    await createAuditLog({
      action: "NETWORK_ESCALATED",
      entityType: "FRAUD_NETWORK",
      entityId: id,
      before: network,
      after: { status: "UNDER_INVESTIGATION", notes },
      userId: session.user.id,
    });
    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
