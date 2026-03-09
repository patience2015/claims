"use client";
import { riskGaugeColor } from "@/lib/risk-utils";

interface Props {
  score: number; // 0–100
  size?: number;
}

export function RiskScoreGauge({ score, size = 96 }: Props) {
  const r = 15.9155;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const strokeDasharray = `${pct * circumference} ${circumference}`;
  const color = riskGaugeColor(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
          {score}
        </span>
        <span className="text-[9px] text-slate-400 uppercase tracking-wide">/100</span>
      </div>
    </div>
  );
}
