"use client";
import type { RiskLevel } from "@/types";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk-utils";

interface Props {
  level: RiskLevel;
  size?: "sm" | "md";
}

export function RiskBadge({ level, size = "md" }: Props) {
  const c = RISK_COLORS[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold border ${c.bg} ${c.text} ${c.border} ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {RISK_LABELS[level]}
    </span>
  );
}
