import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;

const QuerySchema = z.object({
  riskLevel: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter((v) => RISK_LEVELS.includes(v as typeof RISK_LEVELS[number])) : undefined))
    .transform((arr) => (arr && arr.length > 0 ? arr : undefined)),
  limit: z.coerce.number().min(1).max(500).default(200),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as string;
  if (!["MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Réservé aux MANAGER et ADMIN" }, { status: 403 });
  }

  const parsed = QuerySchema.safeParse({
    riskLevel: req.nextUrl.searchParams.get("riskLevel"),
    limit: req.nextUrl.searchParams.get("limit"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides", details: parsed.error.issues }, { status: 400 });
  }

  const { riskLevel, limit } = parsed.data;
  const now = new Date();
  const riskLevelFilter = riskLevel ? { riskLevel: { in: riskLevel } } : {};

  const scores = await prisma.riskScore.findMany({
    where: { expiresAt: { gt: now }, ...riskLevelFilter },
    orderBy: { computedAt: "desc" },
    take: limit * 3,
    include: {
      policyholder: {
        select: { id: true, firstName: true, lastName: true, address: true, latitude: true, longitude: true },
      },
    },
  });

  // Dédupliquer : garder le score le plus récent par assuré
  const seen = new Set<string>();
  const points = scores
    .filter((s) => { if (seen.has(s.policyholderId)) return false; seen.add(s.policyholderId); return true; })
    .slice(0, limit)
    .map((s) => ({
      policyholderId: s.policyholderId,
      firstName: s.policyholder.firstName,
      lastName: s.policyholder.lastName,
      address: s.policyholder.address,
      lat: s.policyholder.latitude,
      lon: s.policyholder.longitude,
      scoreGlobal: s.scoreGlobal,
      riskLevel: s.riskLevel,
      computedAt: s.computedAt.toISOString(),
    }));

  return NextResponse.json({ data: points, total: points.length, generatedAt: now.toISOString() });
}
