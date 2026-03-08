import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Statuses for which the policyholder can upload documents */
const CAN_UPLOAD_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"];

/** Statuses for which a decision (accept/reject) is offered to the policyholder */
const CAN_DECIDE_STATUSES = ["APPROVED"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== "POLICYHOLDER") {
    return NextResponse.json({ error: "Accès réservé aux assurés" }, { status: 403 });
  }

  const policyholderID = session.user.policyholderID;
  if (!policyholderID) {
    return NextResponse.json({ error: "Profil assuré introuvable" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const claim = await prisma.claim.findUnique({
      where: { id },
      select: {
        id: true,
        claimNumber: true,
        status: true,
        type: true,
        description: true,
        incidentDate: true,
        incidentLocation: true,
        thirdPartyInvolved: true,
        estimatedAmount: true,
        approvedAmount: true,
        closureReason: true,
        policyholderID: true,
        createdAt: true,
        updatedAt: true,
        documents: {
          select: { id: true, filename: true, mimeType: true, size: true, url: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!claim) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });

    // Ownership check
    if (claim.policyholderID !== policyholderID) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json({
      data: {
        ...claim,
        canUpload: CAN_UPLOAD_STATUSES.includes(claim.status),
        canDecide: CAN_DECIDE_STATUSES.includes(claim.status) && claim.approvedAmount !== null,
      },
    });
  } catch (err) {
    console.error("[portail/claims/[id]] GET error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
