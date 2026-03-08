import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateUserSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const roleFilter = searchParams.get("role");
  const activeFilter = searchParams.get("active");

  // MANAGERs can only list HANDLERs (not other MANAGERs or ADMINs)
  const where = {
    ...(session.user.role === "MANAGER"
      ? { role: "HANDLER" as const }
      : roleFilter ? { role: roleFilter as "HANDLER" | "MANAGER" | "ADMIN" } : {}),
    ...(activeFilter !== null ? { active: activeFilter === "true" } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, _count: { select: { assignedClaims: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: { ...parsed.data, password: hashedPassword },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });

  await createAuditLog({
    action: "USER_CREATED",
    entityType: "USER",
    entityId: user.id,
    after: { email: user.email, name: user.name, role: user.role },
    userId: session.user.id,
  });

  return NextResponse.json({ data: user }, { status: 201 });
}
