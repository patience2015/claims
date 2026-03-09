import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FraudNetworkQuerySchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = FraudNetworkQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status, page, pageSize, sort } = parsed.data;

  const where = {
    ...(status
      ? { status: { in: status.split(",") } }
      : { status: { in: ["SUSPECT", "CRITICAL", "UNDER_INVESTIGATION"] } }),
    archivedAt: null,
  };

  const orderBy =
    sort === "score_desc"
      ? { networkScore: "desc" as const }
      : sort === "score_asc"
      ? { networkScore: "asc" as const }
      : sort === "date_desc"
      ? { createdAt: "desc" as const }
      : { createdAt: "asc" as const };

  const [total, networks] = await Promise.all([
    prisma.fraudNetwork.count({ where }),
    prisma.fraudNetwork.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    data: networks,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
