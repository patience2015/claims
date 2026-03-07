import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UpdatePolicyholderSchema } from "@/lib/validations";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const policyholder = await prisma.policyholder.findUnique({
    where: { id },
    include: { claims: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  if (!policyholder) return NextResponse.json({ error: "Assuré introuvable" }, { status: 404 });
  return NextResponse.json({ data: policyholder });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role === "HANDLER") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdatePolicyholderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const policyholder = await prisma.policyholder.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.contractStart ? { contractStart: new Date(parsed.data.contractStart) } : {}),
      ...(parsed.data.contractEnd ? { contractEnd: new Date(parsed.data.contractEnd) } : {}),
    },
  });

  return NextResponse.json({ data: policyholder });
}
