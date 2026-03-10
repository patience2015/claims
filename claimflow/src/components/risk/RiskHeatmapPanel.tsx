"use client";
import { useState, useEffect } from "react";
import { RefreshCw, MapPin } from "lucide-react";
import type { RiskHeatmapPoint, RiskLevel } from "@/types";
import { RiskBadge } from "./RiskBadge";
import { RISK_COLORS } from "@/lib/risk-utils";

const DOT_COLORS: Record<RiskLevel, string> = {
  LOW:      "#10b981",
  MODERATE: "#f59e0b",
  HIGH:     "#f97316",
  CRITICAL: "#ef4444",
};
const DOT_SIZES: Record<RiskLevel, number> = {
  LOW:      4,
  MODERATE: 5,
  HIGH:     6,
  CRITICAL: 8,
};

const CLAIM_TYPE_LABELS: Record<string, string> = {
  COLLISION: "Collision",
  THEFT: "Vol",
  FIRE: "Incendie",
  GLASS: "Bris de glace",
  VANDALISM: "Vandalisme",
  NATURAL_DISASTER: "Catastrophe naturelle",
  OTHER: "Autre",
};

// France bounding box (approx)
const FRANCE_BOUNDS = { minLat: 41.3, maxLat: 51.1, minLon: -5.2, maxLon: 9.6 };

function projectPoint(lat: number, lon: number, width: number, height: number) {
  const x = ((lon - FRANCE_BOUNDS.minLon) / (FRANCE_BOUNDS.maxLon - FRANCE_BOUNDS.minLon)) * width;
  const y = ((FRANCE_BOUNDS.maxLat - lat) / (FRANCE_BOUNDS.maxLat - FRANCE_BOUNDS.minLat)) * height;
  return { x, y };
}

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "CRITICAL,HIGH", label: "Critique + Élevé" },
  { value: "CRITICAL", label: "Critique" },
  { value: "HIGH", label: "Élevé" },
  { value: "MODERATE", label: "Modéré" },
  { value: "LOW", label: "Faible" },
];

export function RiskHeatmapPanel() {
  const [points, setPoints] = useState<RiskHeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<RiskHeatmapPoint | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const SVG_W = 400;
  const SVG_H = 480;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (filter) params.set("riskLevel", filter);
    fetch(`/api/analytics/risk-heatmap?${params.toString()}`)
      .then((r) => r.json())
      .then((json: { data: RiskHeatmapPoint[] }) => setPoints(json.data || []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [filter, refreshKey]);

  const geoPoints = points.filter((p) => p.lat !== null && p.lon !== null);
  const noGeoCount = points.length - geoPoints.length;

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Carte de risque géographique
            </h2>
            <p className="text-[10px] text-slate-400">{geoPoints.length} sinistre(s) localisés sur {points.length} total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="h-8 w-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* SVG Map */}
        <div className="flex-1 p-4 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10 rounded-xl">
              <RefreshCw className="h-5 w-5 text-indigo-400 animate-spin" />
            </div>
          )}
          <div className="relative bg-slate-50/60 rounded-xl overflow-hidden border border-slate-100">
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ maxHeight: 480 }}>
              {/* France silhouette */}
              <ellipse cx={SVG_W / 2} cy={SVG_H / 2} rx={SVG_W * 0.45} ry={SVG_H * 0.46}
                fill="#e8edf5" stroke="#c8d3e0" strokeWidth="1.5" />
              <text x={SVG_W / 2} y={SVG_H / 2 + 4} textAnchor="middle"
                fill="#94a3b8" fontSize="12" fontFamily="Inter, sans-serif">FRANCE</text>

              {/* Points */}
              {geoPoints.map((p) => {
                const { x, y } = projectPoint(p.lat!, p.lon!, SVG_W, SVG_H);
                const r = DOT_SIZES[p.riskLevel] ?? 5;
                const color = DOT_COLORS[p.riskLevel] ?? "#64748b";
                const isSelected = selected?.claimId === p.claimId;
                return (
                  <g key={p.claimId} onClick={() => setSelected(isSelected ? null : p)} className="cursor-pointer">
                    {p.riskLevel === "CRITICAL" && (
                      <circle cx={x} cy={y} r={r + 4} fill={color} opacity="0.15">
                        <animate attributeName="r" values={`${r + 4};${r + 8};${r + 4}`} dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.15;0;0.15" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      cx={x} cy={y} r={isSelected ? r + 2 : r}
                      fill={color}
                      stroke={isSelected ? "white" : "white"}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      opacity="0.9"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex flex-col gap-1">
              {(["CRITICAL", "HIGH", "MODERATE", "LOW"] as RiskLevel[]).map((level) => {
                const c = RISK_COLORS[level];
                const count = geoPoints.filter((p) => p.riskLevel === level).length;
                if (count === 0) return null;
                return (
                  <div key={level} className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 border ${c.bg} ${c.border}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: DOT_COLORS[level] }} />
                    <span className={`text-[9px] font-semibold ${c.text}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {noGeoCount > 0 && (
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              {noGeoCount} sinistre(s) avec lieu non reconnu non affichés
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-56 border-l border-slate-100 p-4 flex flex-col gap-3">
          {selected ? (
            <div>
              <button onClick={() => setSelected(null)} className="text-[10px] text-indigo-500 hover:underline mb-3">← Retour</button>
              <div className="space-y-2">
                <p className="font-semibold text-slate-800 text-xs">{selected.claimNumber}</p>
                <p className="text-[10px] text-slate-500">{CLAIM_TYPE_LABELS[selected.type] ?? selected.type}</p>
                <RiskBadge level={selected.riskLevel} size="sm" />
                <div className="text-[10px] text-slate-500 space-y-1 mt-2">
                  <p><span className="font-medium">Score fraude :</span> {selected.fraudScore}/100</p>
                  <p><span className="font-medium">Lieu :</span> {selected.incidentLocation}</p>
                  <p><span className="font-medium">Date :</span> {new Date(selected.incidentDate).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Top sinistres</p>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-96">
                {points.slice(0, 15).map((p) => (
                  <button
                    key={p.claimId}
                    onClick={() => setSelected(p)}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-semibold text-slate-700 truncate">
                        {p.claimNumber}
                      </span>
                      <span className="text-[10px] font-bold text-slate-600 ml-1 shrink-0">{p.fraudScore}</span>
                    </div>
                    <RiskBadge level={p.riskLevel} size="sm" />
                    <p className="text-[9px] text-slate-400 mt-0.5 truncate">{CLAIM_TYPE_LABELS[p.type] ?? p.type}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
