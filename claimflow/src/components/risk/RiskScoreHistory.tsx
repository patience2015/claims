"use client";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { RiskScoreHistoryItem } from "@/types";
import { RISK_LABELS } from "@/lib/risk-utils";

interface Props {
  policyholderId: string;
  limit?: number;
}

export function RiskScoreHistory({ policyholderId, limit = 15 }: Props) {
  const [history, setHistory] = useState<RiskScoreHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analytics/risk-score/${policyholderId}/history?limit=${limit}`)
      .then((r) => r.json())
      .then((json: { data: RiskScoreHistoryItem[] }) => setHistory(json.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [policyholderId, limit]);

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-5 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="h-28 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (history.length === 0) return null;

  const chartData = [...history].reverse().map((h) => ({
    date: new Date(h.computedAt).toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
    score: h.scoreGlobal,
    level: RISK_LABELS[h.riskLevel as keyof typeof RISK_LABELS] ?? h.riskLevel,
  }));

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
          Évolution du risque
        </span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={24} />
            <Tooltip
              contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.95)", fontSize: "11px" }}
              formatter={(v: number, _name: string, props: { payload?: { level: string } }) => [
                `${v}/100 — ${props?.payload?.level ?? ""}`,
                "Score"
              ]}
            />
            <ReferenceLine y={76} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
            <ReferenceLine y={56} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1} />
            <ReferenceLine y={31} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
            <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2} dot={{ r: 2, fill: "#4f46e5" }} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-3 mt-2 justify-end">
          {[
            { label: "Critique", color: "#ef4444" },
            { label: "Élevé",    color: "#f97316" },
            { label: "Modéré",   color: "#f59e0b" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="h-px w-4 border-t border-dashed" style={{ borderColor: color }} />
              <span className="text-[9px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
