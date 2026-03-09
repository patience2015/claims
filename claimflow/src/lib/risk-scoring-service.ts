import { prisma } from "@/lib/prisma";
import { getWeatherScore } from "@/lib/weather-service";
import { createAuditLog } from "@/lib/audit";
import type { RiskLevel, WeatherDataSource, RiskScoreItem } from "@/types";

const HIGH_RISK_DEPARTMENTS = ["13", "75", "93", "94", "69", "59", "31", "33", "06"];

function classifyRiskLevel(score: number): RiskLevel {
  if (score >= 76) return "CRITICAL";
  if (score >= 56) return "HIGH";
  if (score >= 31) return "MODERATE";
  return "LOW";
}

function getContractStatus(contractEnd: Date): string {
  const now = new Date();
  if (contractEnd < now) return "EXPIRED";
  const daysLeft = (contractEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 30) return "EXPIRING_SOON";
  return "ACTIVE";
}

interface ComputedFactors {
  factorHistorique: number;
  factorProfil: number;
  factorZone: number;
  factorPeriode: number;
  factorMeteo: number;
  weatherDataSource: WeatherDataSource;
  weatherSummary: string;
  highFrequencyClaimant: boolean;
  contractStatus: string;
  notes: string[];
}

async function computeFactors(policyholderId: string): Promise<ComputedFactors> {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const notes: string[] = [];

  const policyholder = await prisma.policyholder.findUnique({
    where: { id: policyholderId },
    include: {
      claims: {
        where: { createdAt: { gte: twelveMonthsAgo } },
        select: { type: true, fraudScore: true, status: true, incidentZipCode: true },
      },
    },
  });

  if (!policyholder) throw new Error(`Policyholder ${policyholderId} not found`);

  // ── Facteur Historique (max 35) ───────────────────────────────────────────
  const claimsCount = policyholder.claims.length;
  let factorHistorique = Math.min(claimsCount * 10, 30);
  if (policyholder.claims.some((c) => c.fraudScore !== null && c.fraudScore >= 70)) {
    factorHistorique = Math.min(factorHistorique + 5, 35);
  }
  const highFrequencyClaimant = claimsCount >= 3;
  if (claimsCount === 0) notes.push("Historique insuffisant — score partiel");

  // ── Facteur Profil (max 20) ───────────────────────────────────────────────
  let factorProfil = 0;
  const contractStart = new Date(policyholder.contractStart);
  const monthsSinceStart = (now.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsSinceStart < 6) factorProfil += 10;
  if (policyholder.coverageType === "THIRD_PARTY") factorProfil += 5;
  const vehicleAge = now.getFullYear() - policyholder.vehicleYear;
  if (vehicleAge > 10) factorProfil += 5;
  factorProfil = Math.min(factorProfil, 20);

  // ── Facteur Zone (max 20) ─────────────────────────────────────────────────
  let factorZone = 10;
  const zipCode = policyholder.address.match(/\b\d{5}\b/)?.[0];
  if (zipCode) {
    const dept = zipCode.substring(0, 2);
    if (HIGH_RISK_DEPARTMENTS.includes(dept)) {
      factorZone = 18;
    } else {
      const nearbyClaims = await prisma.claim.count({
        where: { incidentZipCode: zipCode, createdAt: { gte: twelveMonthsAgo } },
      });
      if (nearbyClaims > 20) factorZone = 20;
      else if (nearbyClaims > 10) factorZone = 15;
      else if (nearbyClaims > 5) factorZone = 10;
      else factorZone = 5;
    }
  } else {
    notes.push("Zone non géocodée — estimation prudente");
  }

  // ── Facteur Période (max 10) ──────────────────────────────────────────────
  const month = now.getMonth() + 1;
  let factorPeriode = 3;
  if ([11, 12, 1, 2].includes(month)) factorPeriode = 10;
  else if ([7, 8].includes(month)) factorPeriode = 7;

  // ── Facteur Météo (max 25) ────────────────────────────────────────────────
  let factorMeteo = 12;
  let weatherDataSource: WeatherDataSource = "FALLBACK_NEUTRAL";
  let weatherSummary = "Données météo indisponibles";

  if (policyholder.latitude !== null && policyholder.longitude !== null) {
    const weather = await getWeatherScore(policyholder.latitude, policyholder.longitude);
    factorMeteo = weather.meteoScore;
    weatherDataSource = weather.source;
    weatherSummary = weather.summary;
  } else {
    notes.push("Coordonnées GPS non disponibles — météo neutralisée");
  }

  const contractStatus = getContractStatus(new Date(policyholder.contractEnd));

  return { factorHistorique, factorProfil, factorZone, factorPeriode, factorMeteo, weatherDataSource, weatherSummary, highFrequencyClaimant, contractStatus, notes };
}

export async function computeRiskScore(
  policyholderId: string,
  options: { forceRefresh?: boolean; userId?: string } = {}
): Promise<RiskScoreItem> {
  const now = new Date();

  // Cache check
  if (!options.forceRefresh) {
    const cached = await prisma.riskScore.findFirst({
      where: { policyholderId, expiresAt: { gt: now } },
      orderBy: { computedAt: "desc" },
    });
    if (cached) {
      return {
        id: cached.id,
        policyholderId: cached.policyholderId,
        scoreGlobal: cached.scoreGlobal,
        riskLevel: cached.riskLevel as RiskLevel,
        factorHistorique: cached.factorHistorique,
        factorProfil: cached.factorProfil,
        factorZone: cached.factorZone,
        factorPeriode: cached.factorPeriode,
        factorMeteo: cached.factorMeteo,
        weatherDataSource: cached.weatherDataSource as WeatherDataSource,
        scoringNotes: cached.scoringNotes,
        highFrequencyClaimant: cached.highFrequencyClaimant,
        contractStatus: cached.contractStatus,
        computedAt: cached.computedAt.toISOString(),
        expiresAt: cached.expiresAt.toISOString(),
        fromCache: true,
      };
    }
  }

  // Compute fresh score
  const factors = await computeFactors(policyholderId);
  const scoreGlobal = Math.min(
    Math.round(factors.factorHistorique + factors.factorProfil + factors.factorZone + factors.factorPeriode + factors.factorMeteo),
    100
  );
  const riskLevel = classifyRiskLevel(scoreGlobal);
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const saved = await prisma.riskScore.create({
    data: {
      policyholderId,
      scoreGlobal,
      riskLevel,
      factorHistorique: factors.factorHistorique,
      factorProfil: factors.factorProfil,
      factorZone: factors.factorZone,
      factorPeriode: factors.factorPeriode,
      factorMeteo: factors.factorMeteo,
      weatherDataSource: factors.weatherDataSource,
      scoringNotes: factors.notes.length > 0 ? JSON.stringify(factors.notes) : null,
      highFrequencyClaimant: factors.highFrequencyClaimant,
      contractStatus: factors.contractStatus,
      expiresAt,
    },
  });

  if (options.userId) {
    await createAuditLog({
      action: "RISK_SCORE_COMPUTED",
      entityType: "POLICYHOLDER",
      entityId: policyholderId,
      after: { scoreGlobal, riskLevel },
      userId: options.userId,
    });
  }

  return {
    id: saved.id,
    policyholderId: saved.policyholderId,
    scoreGlobal: saved.scoreGlobal,
    riskLevel: saved.riskLevel as RiskLevel,
    factorHistorique: saved.factorHistorique,
    factorProfil: saved.factorProfil,
    factorZone: saved.factorZone,
    factorPeriode: saved.factorPeriode,
    factorMeteo: saved.factorMeteo,
    weatherDataSource: saved.weatherDataSource as WeatherDataSource,
    scoringNotes: saved.scoringNotes,
    highFrequencyClaimant: saved.highFrequencyClaimant,
    contractStatus: saved.contractStatus,
    computedAt: saved.computedAt.toISOString(),
    expiresAt: saved.expiresAt.toISOString(),
    fromCache: false,
  };
}

export async function computeAllRiskScores(
  scope: "ALL" | "STALE_ONLY" = "STALE_ONLY"
): Promise<{ processed: number; errors: number; durationMs: number }> {
  const start = Date.now();
  let processed = 0, errors = 0;
  const now = new Date();

  let policyholderIds: string[];
  if (scope === "STALE_ONLY") {
    const stale = await prisma.policyholder.findMany({
      select: { id: true },
      where: {
        OR: [
          { riskScores: { none: {} } },
          { riskScores: { every: { expiresAt: { lt: now } } } },
        ],
      },
    });
    policyholderIds = stale.map((p) => p.id);
  } else {
    const all = await prisma.policyholder.findMany({ select: { id: true } });
    policyholderIds = all.map((p) => p.id);
  }

  for (let i = 0; i < policyholderIds.length; i += 10) {
    const batch = policyholderIds.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map((id) => computeRiskScore(id, { forceRefresh: true })));
    for (const r of results) {
      if (r.status === "fulfilled") processed++;
      else errors++;
    }
  }

  return { processed, errors, durationMs: Date.now() - start };
}
