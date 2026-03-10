import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const report = await prisma.acprReport.findUnique({
      where: { id },
      include: { generatedBy: { select: { id: true, name: true, email: true } } },
    });

    if (!report) return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });

    return NextResponse.json({ data: report });
  } catch (err) {
    console.error("[GET /api/compliance/acpr/reports/[id]]", err);
    return NextResponse.json({ error: "Erreur serveur", details: String(err) }, { status: 500 });
  }
}
