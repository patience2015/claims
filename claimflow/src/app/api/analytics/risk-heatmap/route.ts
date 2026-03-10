import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;

const QuerySchema = z.object({
  riskLevel: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(",").filter((v) => RISK_LEVELS.includes(v as (typeof RISK_LEVELS)[number])) : undefined
    )
    .transform((arr) => (arr && arr.length > 0 ? arr : undefined)),
  limit: z.coerce.number().min(1).max(500).default(200),
});

// Coordonnées approximatives des principales villes françaises
const CITY_COORDS: Record<string, [number, number]> = {
  paris: [48.8566, 2.3522],
  lyon: [45.7640, 4.8357],
  marseille: [43.2965, 5.3698],
  toulouse: [43.6047, 1.4442],
  nice: [43.7102, 7.2620],
  nantes: [47.2184, -1.5536],
  bordeaux: [44.8378, -0.5792],
  strasbourg: [48.5734, 7.7521],
  lille: [50.6292, 3.0573],
  rennes: [48.1173, -1.6778],
  grenoble: [45.1885, 5.7245],
  montpellier: [43.6108, 3.8767],
  rouen: [49.4432, 1.0993],
  reims: [49.2583, 4.0317],
  metz: [49.1193, 6.1727],
  dijon: [47.3220, 5.0415],
  angers: [47.4784, -0.5632],
  le_havre: [49.4938, 0.1079],
  clermont: [45.7797, 3.0863],
  tours: [47.3941, 0.6848],
};

/**
 * Extrait les coordonnées depuis une adresse texte en cherchant le nom d'une ville connue.
 * Retourne null si aucune ville n'est reconnue.
 */
function extractCoords(location: string): [number, number] | null {
  const normalized = location.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(city.replace("_", " "))) {
      return coords;
    }
  }
  return null;
}

/**
 * Jitter déterministe basé sur l'id pour éviter l'empilement des points d'une même ville.
 * Utilise un hash simple sur les derniers caractères de l'id.
 */
function deterministicJitter(id: string, range = 0.12): [number, number] {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const dLat = ((hash * 13) % 200) / 1000 - range;
  const dLon = ((hash * 7) % 200) / 1000 - range;
  return [dLat, dLon];
}

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

  const claims = await prisma.claim.findMany({
    where: {
      incidentLocation: { not: "" },
      fraudRisk: riskLevel ? { in: riskLevel } : undefined,
    },
    orderBy: { fraudScore: "desc" },
    take: limit,
    select: {
      id: true,
      claimNumber: true,
      type: true,
      incidentLocation: true,
      fraudScore: true,
      fraudRisk: true,
      incidentDate: true,
    },
  });

  const now = new Date();

  const points = claims.map((c) => {
    const base = extractCoords(c.incidentLocation);
    let lat: number | null = null;
    let lon: number | null = null;
    if (base) {
      const [dLat, dLon] = deterministicJitter(c.id);
      lat = base[0] + dLat;
      lon = base[1] + dLon;
    }
    return {
      claimId: c.id,
      claimNumber: c.claimNumber,
      type: c.type,
      incidentLocation: c.incidentLocation,
      lat,
      lon,
      fraudScore: c.fraudScore ?? 0,
      riskLevel: (c.fraudRisk ?? "LOW") as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
      incidentDate: c.incidentDate.toISOString(),
    };
  });

  return NextResponse.json({ data: points, total: points.length, generatedAt: now.toISOString() });
}
