"use client";
import { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import type { RiskScoreItem } from "@/types";
import { RiskBadge } from "./RiskBadge";
import { RiskScoreGauge } from "./RiskScoreGauge";

interface Props {
  policyholderId: string;
}

const FACTORS = [
  { key: "factorHistorique", label: "Historique",  max: 35 },
  { key: "factorProfil",     label: "Profil",       max: 20 },
  { key: "factorZone",       label: "Zone",          max: 20 },
  { key: "factorPeriode",    label: "Période",       max: 10 },
  { key: "factorMeteo",      label: "Météo",         max: 25 },
] as const;

export function RiskScoreWidget({ policyholderId }: Props) {
  const [score, setScore] = useState<RiskScoreItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScore = async (force = false) => {
    try {
      const res = await fetch(`/api/analytics/risk-score/${policyholderId}${force ? "?force=true" : ""}`);
      if (!res.ok) throw new Error("Erreur chargement score");
      const json = (await res.json()) as { data: RiskScoreItem };
      setScore(json.data);
      setError(null);
    } catch {
      setError("Score indisponible");
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchScore().finally(() => setLoading(false));
  }, [policyholderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchScore(true);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-5 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
        <div className="h-24 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (error || !score) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-5">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <AlertTriangle className="h-4 w-4" />
          {error || "Score indisponible"}
        </div>
      </div>
    );
  }

  let notes: string[] = [];
  try {
    notes = score.scoringNotes ? (JSON.parse(score.scoringNotes) as string[]) : [];
  } catch {
    notes = [];
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center">
            <span className="text-indigo-600 text-xs font-bold">R</span>
          </div>
          <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
            Score de risque
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-7 w-7 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          title="Recalculer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-5">
        {/* Top: gauge + level */}
        <div className="flex items-center gap-5 mb-5">
          <RiskScoreGauge score={score.scoreGlobal} size={88} />
          <div>
            <RiskBadge level={score.riskLevel} />
            {score.highFrequencyClaimant && (
              <div className="mt-1.5 text-[10px] font-medium text-amber-600 bg-amber-50 rounded px-2 py-0.5 border border-amber-100 inline-block">
                Sinistralité élevée
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1.5">
              {score.fromCache ? "Depuis le cache" : "Calculé maintenant"}
            </p>
            <p className="text-[10px] text-slate-400">
              Expire : {new Date(score.expiresAt).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        {/* Factors */}
        <div className="space-y-2.5">
          {FACTORS.map(({ key, label, max }) => {
            const val = score[key] as number;
            const pct = (val / max) * 100;
            const barColor = pct >= 80 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-indigo-400";
            return (
              <div key={key}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-700">{val.toFixed(0)}<span className="text-slate-400">/{max}</span></span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes */}
        {notes.length > 0 && (
          <div className="mt-3 p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
            <p className="text-[10px] text-amber-700 font-medium mb-1">Alertes scoring</p>
            {notes.map((n, i) => (
              <p key={i} className="text-[10px] text-amber-600">{n}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
