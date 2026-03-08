import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/** Statuses for which the policyholder can upload documents */
const CAN_UPLOAD_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"];

export async function POST(
  req: NextRequest,
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
    const claim = await prisma.claim.findUnique({ where: { id } });
    if (!claim) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });

    // Ownership check
    if (claim.policyholderID !== policyholderID) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Status check
    if (!CAN_UPLOAD_STATUSES.includes(claim.status)) {
      return NextResponse.json(
        { error: "Upload non disponible pour ce statut" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format non autorisé (PDF, JPG, PNG uniquement)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 5 Mo)" },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "uploads", id);
    await mkdir(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const document = await prisma.document.create({
      data: {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        url: `/uploads/${id}/${filename}`,
        claimId: id,
      },
    });

    await createAuditLog({
      action: "DOCUMENT_UPLOADED_BY_POLICYHOLDER",
      entityType: "DOCUMENT",
      entityId: document.id,
      after: { filename: file.name, size: file.size, mimeType: file.type, source: "portail" },
      claimId: id,
      userId: session.user.id,
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (err) {
    console.error("[portail/claims/[id]/documents] POST error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
