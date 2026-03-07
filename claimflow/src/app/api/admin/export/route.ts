import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") || "claims";

  if (type === "claims") {
    const claims = await prisma.claim.findMany({
      include: {
        policyholder: true,
        assignedTo: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Numéro", "Statut", "Type", "Date sinistre", "Lieu", "Assuré", "Numéro police",
      "Véhicule", "Immatriculation", "Score fraude", "Risque fraude",
      "Montant estimé", "Montant approuvé", "Gestionnaire", "Créé par", "Date création"
    ];

    const rows = claims.map(c => [
      c.claimNumber,
      c.status,
      c.type,
      c.incidentDate.toISOString().split("T")[0],
      c.incidentLocation,
      `${c.policyholder.firstName} ${c.policyholder.lastName}`,
      c.policyholder.policyNumber,
      `${c.policyholder.vehicleMake} ${c.policyholder.vehicleModel} ${c.policyholder.vehicleYear}`,
      c.policyholder.vehiclePlate,
      c.fraudScore?.toString() || "",
      c.fraudRisk || "",
      c.estimatedAmount?.toString() || "",
      c.approvedAmount?.toString() || "",
      c.assignedTo?.name || "",
      c.createdBy.name,
      c.createdAt.toISOString().split("T")[0],
    ]);

    const BOM = "\uFEFF";
    const csv = BOM + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(";")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="sinistres-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Type d'export non supporté" }, { status: 400 });
}
