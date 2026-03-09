import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== "POLICYHOLDER") {
    return NextResponse.json({ error: "Accès réservé aux assurés" }, { status: 403 });
  }

  const policyholderID = session.user.policyholderID;
  if (!policyholderID) {
    return NextResponse.json({ error: "Profil assuré introuvable" }, { status: 404 });
  }

  try {
    const claims = await prisma.claim.findMany({
      where: { policyholderID },
      select: {
        id: true,
        claimNumber: true,
        status: true,
        type: true,
        description: true,
        incidentDate: true,
        incidentLocation: true,
        estimatedAmount: true,
        approvedAmount: true,
        closureReason: true,
        createdAt: true,
        updatedAt: true,
        documents: {
          select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: claims });
  } catch (err) {
    console.error("[portail/claims] GET error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
