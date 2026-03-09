import type { RiskLevel } from "@/types";

export const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string; dot: string }> = {
  LOW:      { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "#10b981" },
  MODERATE: { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "#f59e0b" },
  HIGH:     { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",  dot: "#f97316" },
  CRITICAL: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     dot: "#ef4444" },
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW:      "Faible",
  MODERATE: "Modéré",
  HIGH:     "Élevé",
  CRITICAL: "Critique",
};

export function riskGaugeColor(score: number): string {
  if (score >= 76) return "#ef4444";
  if (score >= 56) return "#f97316";
  if (score >= 31) return "#f59e0b";
  return "#10b981";
}
