import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateCommentSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });

  const comments = await prisma.comment.findMany({
    where: { claimId: id },
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: comments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = CreateCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "Sinistre introuvable" }, { status: 404 });

  const comment = await prisma.comment.create({
    data: {
      content: parsed.data.content,
      isInternal: parsed.data.isInternal,
      claimId: id,
      authorId: session.user.id,
    },
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
  });

  await createAuditLog({
    action: "COMMENT_ADDED",
    entityType: "COMMENT",
    entityId: comment.id,
    after: { content: comment.content.substring(0, 100), isInternal: comment.isInternal },
    claimId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ data: comment }, { status: 201 });
}
