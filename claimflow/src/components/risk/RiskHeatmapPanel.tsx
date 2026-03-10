"use client";
import { useState, useEffect, useRef } from "react";
import { RefreshCw, MapPin, Shield } from "lucide-react";
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
  LOW: 5, MODERATE: 6, HIGH: 8, CRITICAL: 10,
};
const CLAIM_TYPE_LABELS: Record<string, string> = {
  COLLISION: "Collision", THEFT: "Vol", FIRE: "Incendie",
  GLASS: "Bris de glace", VANDALISM: "Vandalisme",
  NATURAL_DISASTER: "Catastrophe naturelle", OTHER: "Autre",
};

// France bounding box
const FRANCE_BOUNDS = { minLat: 41.3, maxLat: 51.1, minLon: -5.2, maxLon: 9.6 };
const SVG_W = 500;
const SVG_H = 520;

function projectPoint(lat: number, lon: number) {
  const x = ((lon - FRANCE_BOUNDS.minLon) / (FRANCE_BOUNDS.maxLon - FRANCE_BOUNDS.minLon)) * SVG_W;
  const y = ((FRANCE_BOUNDS.maxLat - lat) / (FRANCE_BOUNDS.maxLat - FRANCE_BOUNDS.minLat)) * SVG_H;
  return { x, y };
}

// Silhouette simplifiée de la France métropolitaine (sens horaire, projetée sur viewBox 500×520)
// Points clés : Dunkerque → frontière belge/allemande → Alpes → Côte d'Azur →
//               Pyrénées → Pays basque → côte atlantique → Bretagne → Normandie → retour
const FRANCE_PATH = [
  "M 255,4",    // Dunkerque (51.03°N, 2.37°E)
  "L 300,10",   // Côte belge est
  "L 382,16",   // Frontière belge/allemande (50.75°N, 6.14°E)
  "L 392,82",   // Frontière luxembourgeoise (49.54°N, 6.37°E)
  "L 455,112",  // Frontière allemande/Rhine (48.97°N, 8.22°E)
  "L 437,132",  // Strasbourg (48.58°N, 7.75°E)
  "L 430,195",  // Frontière suisse (46.95°N, 7.59°E)
  "L 412,222",  // Mont-Blanc / frontière italienne (45.86°N, 7.01°E)
  "L 424,290",  // Frontière italienne, val d'Aoste
  "L 430,395",  // Nice / frontière italienne côte (43.75°N, 7.43°E)
  "L 395,420",  // Toulon (43.12°N, 5.93°E)
  "L 355,415",  // Marseille (43.30°N, 5.37°E)
  "L 302,408",  // Montpellier côte (43.45°N, 3.69°E)
  "L 282,454",  // Perpignan / frontière espagnole (42.45°N, 3.17°E)
  "L 196,448",  // Pyrénées centre (42.65°N, 1.5°E)
  "L 118,406",  // Bayonne / Pays basque (43.49°N, -1.47°E)
  "L 108,340",  // Côte landaise
  "L 96,310",   // Arcachon (44.66°N, -1.17°E)
  "L 102,262",  // La Rochelle (46.16°N, -1.15°E)
  "L 82,228",   // Noirmoutier (47.0°N, -2.26°E)
  "L 98,205",   // Saint-Nazaire (47.27°N, -2.21°E)
  "L 68,194",   // Quiberon (47.48°N, -3.11°E)
  "L 22,146",   // Brest (48.39°N, -4.49°E)
  "L 32,132",   // Finistère nord
  "L 48,135",   // Morlaix (48.58°N, -3.83°E)
  "L 112,132",  // Saint-Malo (48.65°N, -2.01°E)
  "L 122,78",   // Cherbourg (49.65°N, -1.62°E)
  "L 168,104",  // Caen (49.18°N, -0.36°E)
  "L 214,64",   // Dieppe (49.92°N, 1.08°E)
  "Z",
].join(" ");

const FILTER_OPTIONS = [
  { value: "", label: "Tous", color: "#6366f1" },
  { value: "CRITICAL", label: "Critique", color: "#ef4444" },
  { value: "HIGH", label: "Élevé", color: "#f97316" },
  { value: "MODERATE", label: "Modéré", color: "#f59e0b" },
  { value: "LOW", label: "Faible", color: "#10b981" },
];

interface TooltipState { point: RiskHeatmapPoint; svgX: number; svgY: number }

export function RiskHeatmapPanel() {
  const [points, setPoints] = useState<RiskHeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<RiskHeatmapPoint | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

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
  const counts = {
    CRITICAL: geoPoints.filter(p => p.riskLevel === "CRITICAL").length,
    HIGH:     geoPoints.filter(p => p.riskLevel === "HIGH").length,
    MODERATE: geoPoints.filter(p => p.riskLevel === "MODERATE").length,
    LOW:      geoPoints.filter(p => p.riskLevel === "LOW").length,
  };

  const handleMouseEnter = (p: RiskHeatmapPoint) => {
    const { x, y } = projectPoint(p.lat!, p.lon!);
    setTooltip({ point: p, svgX: x, svgY: y });
  };

  // Convert SVG coords to % for CSS positioning inside the SVG container
  const tooltipStyle = tooltip
    ? {
        left: `${(tooltip.svgX / SVG_W) * 100}%`,
        top: `${(tooltip.svgY / SVG_H) * 100}%`,
        transform: tooltip.svgX > SVG_W * 0.65
          ? "translate(-110%, -50%)"
          : "translate(16px, -50%)",
      }
    : {};

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-md">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Carte de risque géographique
            </h2>
            <p className="text-[10px] text-slate-400">
              {geoPoints.length} sinistre(s) localisés
              {noGeoCount > 0 ? ` · ${noGeoCount} non localisés` : ""}
            </p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border transition-all duration-150 ${
                  active
                    ? "text-white border-transparent shadow-sm"
                    : "border-slate-200 text-slate-500 bg-white hover:border-slate-300 hover:text-slate-700"
                }`}
                style={active ? { background: opt.color } : {}}
              >
                {opt.value && (
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: active ? "rgba(255,255,255,0.8)" : opt.color }}
                  />
                )}
                {opt.label}
              </button>
            );
          })}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="h-7 w-7 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-1"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Map */}
        <div className="flex-1 p-5 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-20 backdrop-blur-sm rounded-2xl">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="h-5 w-5 text-indigo-400 animate-spin" />
                <p className="text-[10px] text-slate-400">Chargement…</p>
              </div>
            </div>
          )}

          <div
            className="relative bg-gradient-to-br from-slate-50 to-indigo-50/20 rounded-2xl border border-slate-100 shadow-inner overflow-hidden"
            onMouseLeave={() => setTooltip(null)}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full"
              style={{ maxHeight: 460, display: "block" }}
            >
              <defs>
                {/* Dot-grid background */}
                <pattern id="hm-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.8" fill="#cbd5e1" opacity="0.4" />
                </pattern>
                {/* Glow filters */}
                <filter id="hm-glow-critical" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="hm-glow-high" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {/* Map gradient */}
                <linearGradient id="hm-map-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#dde9f8" />
                  <stop offset="100%" stopColor="#c8d8ee" />
                </linearGradient>
              </defs>

              {/* Dot-grid bg */}
              <rect width={SVG_W} height={SVG_H} fill="url(#hm-dots)" />

              {/* France shadow */}
              <path d={FRANCE_PATH} fill="#a8bcd4" transform="translate(4,5)" opacity="0.25" />
              {/* France fill */}
              <path
                d={FRANCE_PATH}
                fill="url(#hm-map-grad)"
                stroke="#8ba6c4"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />

              {/* Country label */}
              <text
                x={SVG_W / 2 - 10} y={SVG_H / 2 + 5}
                textAnchor="middle"
                fill="#8fa8c0"
                fontSize="10"
                fontFamily="Inter, sans-serif"
                letterSpacing="5"
                fontWeight="600"
              >
                FRANCE
              </text>

              {/* Halo de densité (CRITICAL + HIGH en arrière-plan) */}
              {geoPoints
                .filter(p => p.riskLevel === "CRITICAL" || p.riskLevel === "HIGH")
                .map((p) => {
                  const { x, y } = projectPoint(p.lat!, p.lon!);
                  return (
                    <circle
                      key={`halo-${p.claimId}`}
                      cx={x} cy={y} r={24}
                      fill={DOT_COLORS[p.riskLevel]}
                      opacity="0.07"
                      style={{ pointerEvents: "none" }}
                    />
                  );
                })}

              {/* Markers */}
              {geoPoints.map((p) => {
                const { x, y } = projectPoint(p.lat!, p.lon!);
                const r = DOT_SIZES[p.riskLevel];
                const color = DOT_COLORS[p.riskLevel];
                const isSelected = selected?.claimId === p.claimId;
                const isHovered = tooltip?.point.claimId === p.claimId;

                return (
                  <g
                    key={p.claimId}
                    onClick={() => setSelected(isSelected ? null : p)}
                    onMouseEnter={() => handleMouseEnter(p)}
                    onMouseLeave={() => setTooltip(null)}
                    className="cursor-pointer"
                    filter={
                      p.riskLevel === "CRITICAL" ? "url(#hm-glow-critical)"
                      : p.riskLevel === "HIGH" ? "url(#hm-glow-high)"
                      : undefined
                    }
                  >
                    {/* Outer pulse — CRITICAL */}
                    {p.riskLevel === "CRITICAL" && (
                      <circle cx={x} cy={y} r={r + 5} fill={color} opacity="0.0">
                        <animate attributeName="r" values={`${r + 4};${r + 14};${r + 4}`} dur="2.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.22;0;0.22" dur="2.2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {/* Inner pulse — CRITICAL + HIGH */}
                    {(p.riskLevel === "CRITICAL" || p.riskLevel === "HIGH") && (
                      <circle cx={x} cy={y} r={r + 2} fill={color} opacity="0.0">
                        <animate attributeName="r" values={`${r + 2};${r + 8};${r + 2}`} dur="2.2s" repeatCount="indefinite" begin="0.4s" />
                        <animate attributeName="opacity" values="0.28;0;0.28" dur="2.2s" repeatCount="indefinite" begin="0.4s" />
                      </circle>
                    )}
                    {/* Hover/selection ring */}
                    {(isSelected || isHovered) && (
                      <circle cx={x} cy={y} r={r + 5} fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
                    )}
                    {/* Main circle */}
                    <circle
                      cx={x} cy={y}
                      r={isHovered || isSelected ? r + 1 : r}
                      fill={color}
                      stroke="white"
                      strokeWidth="2"
                      opacity="0.93"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Tooltip (positionné en % du conteneur SVG) */}
            {tooltip && (
              <div
                className="absolute z-30 pointer-events-none"
                style={tooltipStyle}
              >
                <div className="bg-white/96 backdrop-blur-md rounded-xl shadow-2xl border border-slate-100 p-3 w-52">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                        {tooltip.point.claimNumber}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {CLAIM_TYPE_LABELS[tooltip.point.type] ?? tooltip.point.type}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg text-white shrink-0 ml-2"
                      style={{ background: DOT_COLORS[tooltip.point.riskLevel] }}
                    >
                      {tooltip.point.fraudScore}
                    </span>
                  </div>
                  <RiskBadge level={tooltip.point.riskLevel} size="sm" />
                  <p className="text-[9px] text-slate-400 mt-2 leading-tight">
                    {tooltip.point.incidentLocation}
                  </p>
                </div>
              </div>
            )}

            {/* Légende en bas à droite */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1">
              {(["CRITICAL", "HIGH", "MODERATE", "LOW"] as RiskLevel[]).map((level) => {
                const cnt = geoPoints.filter(p => p.riskLevel === level).length;
                if (cnt === 0) return null;
                const c = RISK_COLORS[level];
                return (
                  <div
                    key={level}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 border ${c.bg} ${c.border} bg-white/80 backdrop-blur-sm`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: DOT_COLORS[level] }} />
                    <span className={`text-[9px] font-bold ${c.text} uppercase tracking-wide`}>{level}</span>
                    <span className="text-[9px] text-slate-500 font-semibold">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-56 border-l border-slate-100 flex flex-col">
          {selected ? (
            <div className="p-4 h-full">
              <button
                onClick={() => setSelected(null)}
                className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 mb-4 font-semibold transition-colors"
              >
                ← Retour
              </button>
              <div className="space-y-3">
                <div>
                  <p className="font-bold text-slate-800 text-sm" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    {selected.claimNumber}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {CLAIM_TYPE_LABELS[selected.type] ?? selected.type}
                  </p>
                </div>
                <RiskBadge level={selected.riskLevel} size="sm" />
                <div className="bg-slate-50/80 rounded-xl p-3 space-y-2.5 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Score fraude</span>
                    <span className="text-[11px] font-bold" style={{ color: DOT_COLORS[selected.riskLevel] }}>
                      {selected.fraudScore}/100
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Lieu sinistre</span>
                    <p className="text-[10px] text-slate-700 font-medium mt-0.5 leading-snug">
                      {selected.incidentLocation}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Date</span>
                    <span className="text-[10px] text-slate-600 font-medium">
                      {new Date(selected.incidentDate).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
                Top sinistres
              </p>
              <div className="flex-1 overflow-y-auto space-y-1 max-h-96 pr-0.5">
                {points.slice(0, 15).map((p) => (
                  <button
                    key={p.claimId}
                    onClick={() => setSelected(p)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                        {p.claimNumber}
                      </span>
                      <span
                        className="text-[9px] font-bold ml-1 shrink-0 px-1.5 py-0.5 rounded-md text-white"
                        style={{ background: DOT_COLORS[p.riskLevel] }}
                      >
                        {p.fraudScore}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-400 truncate">
                        {CLAIM_TYPE_LABELS[p.type] ?? p.type}
                      </span>
                      {p.lat !== null
                        ? <MapPin className="h-2.5 w-2.5 text-indigo-300 shrink-0" />
                        : <span className="text-[8px] text-slate-300 shrink-0">non loc.</span>
                      }
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-t border-slate-100 px-6 py-3 bg-gradient-to-r from-slate-50/80 to-white/50 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Shield className="h-3 w-3 text-indigo-500" />
          </div>
          <div>
            <p className="text-[8px] text-slate-400 uppercase tracking-wide leading-none">Total</p>
            <p className="text-xs font-bold text-slate-700 leading-tight">{points.length}</p>
          </div>
        </div>
        {(["CRITICAL", "HIGH", "MODERATE", "LOW"] as RiskLevel[]).map((level) => {
          const cnt = counts[level];
          if (cnt === 0) return null;
          return (
            <div key={level} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ background: DOT_COLORS[level] }} />
              <div>
                <p className="text-[8px] text-slate-400 leading-none capitalize">{level.toLowerCase()}</p>
                <p className="text-xs font-bold leading-tight" style={{ color: DOT_COLORS[level] }}>{cnt}</p>
              </div>
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-1 text-[9px] text-slate-400">
          <MapPin className="h-2.5 w-2.5 text-slate-300" />
          {geoPoints.length}/{points.length} localisés
        </div>
      </div>
    </div>
  );
}
