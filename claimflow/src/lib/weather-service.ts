import { prisma } from "@/lib/prisma";

export interface WeatherScoreResult {
  meteoScore: number;
  source: "LIVE" | "CACHE" | "FALLBACK_NEUTRAL";
  forecastJson: string;
  summary: string;
}

function roundCoord(coord: number): number {
  return Math.round(coord * 100) / 100;
}

interface DailyForecast {
  precipitation_sum: number[];
  snowfall_sum: number[];
  windspeed_10m_max: number[];
  temperature_2m_min: number[];
}

function computeMeteoScore(daily: DailyForecast): { score: number; summary: string } {
  let maxScore = 0;
  const risks: string[] = [];

  for (let i = 0; i < (daily.precipitation_sum?.length ?? 0); i++) {
    const precip = daily.precipitation_sum?.[i] ?? 0;
    const snow = daily.snowfall_sum?.[i] ?? 0;
    const wind = daily.windspeed_10m_max?.[i] ?? 0;
    const tempMin = daily.temperature_2m_min?.[i] ?? 10;

    if (snow > 0) { maxScore = Math.max(maxScore, 25); risks.push("neige"); }
    else if (tempMin < 0 && precip > 0) { maxScore = Math.max(maxScore, 22); risks.push("verglas"); }
    if (wind > 80) { maxScore = Math.max(maxScore, 20); risks.push("vent fort"); }
    if (precip > 10) { maxScore = Math.max(maxScore, 18); risks.push("fortes pluies"); }
    else if (precip > 5) { maxScore = Math.max(maxScore, 10); }
  }

  return {
    score: Math.min(maxScore, 25),
    summary: risks.length > 0
      ? `Risques météo: ${[...new Set(risks)].join(", ")}`
      : "Aucun aléa météo prévu",
  };
}

export async function getWeatherScore(lat: number, lon: number): Promise<WeatherScoreResult> {
  const latR = roundCoord(lat);
  const lonR = roundCoord(lon);
  const now = new Date();

  // 1. Cache hit
  const cached = await prisma.weatherCache.findUnique({
    where: { latRounded_lonRounded: { latRounded: latR, lonRounded: lonR } },
  });
  if (cached && cached.expiresAt > now) {
    return {
      meteoScore: cached.meteoScore,
      source: "CACHE",
      forecastJson: cached.forecastJson,
      summary: "Données en cache",
    };
  }

  // 2. Live fetch Open-Meteo (gratuit, sans clé API)
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=precipitation_sum,snowfall_sum,windspeed_10m_max,temperature_2m_min` +
      `&forecast_days=7&timezone=auto`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

    const data = await res.json() as { daily: DailyForecast };
    const { score, summary } = computeMeteoScore(data.daily);
    const forecastJson = JSON.stringify(data.daily);
    const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    await prisma.weatherCache.upsert({
      where: { latRounded_lonRounded: { latRounded: latR, lonRounded: lonR } },
      create: { latRounded: latR, lonRounded: lonR, forecastJson, meteoScore: score, expiresAt },
      update: { forecastJson, meteoScore: score, fetchedAt: now, expiresAt },
    });

    return { meteoScore: score, source: "LIVE", forecastJson, summary };
  } catch {
    // 3. Fallback neutre
    return { meteoScore: 12, source: "FALLBACK_NEUTRAL", forecastJson: "{}", summary: "Données météo indisponibles" };
  }
}
