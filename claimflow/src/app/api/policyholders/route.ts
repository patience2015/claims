import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreatePolicyholderSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20"));

  const where = search ? {
    OR: [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
      { policyNumber: { contains: search } },
      { vehiclePlate: { contains: search } },
    ],
  } : {};

  const [policyholders, total] = await Promise.all([
    prisma.policyholder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.policyholder.count({ where }),
  ]);

  return NextResponse.json({ data: policyholders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const parsed = CreatePolicyholderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.policyholder.findUnique({ where: { policyNumber: parsed.data.policyNumber } });
  if (existing) {
    return NextResponse.json({ error: "Numéro de police déjà utilisé" }, { status: 409 });
  }

  const policyholder = await prisma.policyholder.create({
    data: {
      ...parsed.data,
      contractStart: new Date(parsed.data.contractStart),
      contractEnd: new Date(parsed.data.contractEnd),
    },
  });

  return NextResponse.json({ data: policyholder }, { status: 201 });
}
