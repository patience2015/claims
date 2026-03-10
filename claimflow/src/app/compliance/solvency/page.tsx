"use client";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { BarChart3, RefreshCw, Calculator } from "lucide-react";

interface Provision {
  id: string;
  claimId: string;
  periodQuarter: string;
  bestEstimate: number;
  scr: number;
  riskMargin: number;
  totalProvision: number;
  probabilityResolution: number;
  status: string;
}

interface SolvReport {
  id: string;
  reportNumber: string;
  periodQuarter: string;
  totalBE: number;
  totalSCR: number;
  totalRM: number;
  totalProvisions: number;
  claimCount: number;
  generatedAt: string;
}

interface ComputeResult {
  claimCount: number;
  totalBE: number;
  totalSCR: number;
  totalRM: number;
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function SolvencyPage() {
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [reports, setReports] = useState<SolvReport[]>([]);
  const [computeResult, setComputeResult] = useState<ComputeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [quarter, setQuarter] = useState(`${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`);
  const [scope, setScope] = useState<"OPEN_ONLY" | "ALL">("OPEN_ONLY");
  const [filterQuarter, setFilterQuarter] = useState("");

  const fetchReports = async () => {
    setReportsLoading(true);
    const res = await fetch("/api/compliance/solvency/reports?pageSize=10");
    const json = (await res.json()) as { data: SolvReport[] };
    setReports(json.data ?? []);
    setReportsLoading(false);
  };

  const fetchProvisions = async (q: string) => {
    const url = q ? `/api/compliance/solvency/provisions?quarter=${encodeURIComponent(q)}&pageSize=50` : "/api/compliance/solvency/provisions?pageSize=50";
    const res = await fetch(url);
    const json = (await res.json()) as { data: Provision[] };
    setProvisions(json.data ?? []);
  };

  useEffect(() => { fetchReports(); fetchProvisions(""); }, []);

  const handleCompute = async () => {
    setLoading(true);
    setComputeResult(null);
    try {
      const res = await fetch("/api/compliance/solvency/provisions/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarter, scope }),
      });
      const json = (await res.json()) as { data: ComputeResult };
      setComputeResult(json.data);
      fetchReports();
      fetchProvisions(quarter);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6" style={{ fontFamily: "Inter, sans-serif" }}>
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
          <div className="relative">
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Conformité · Solvabilité II</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Provisions Techniques SolvII
            </h1>
            <p className="text-indigo-200 text-sm mt-1">Best Estimate · SCR · Risk Margin · Calcul trimestriel</p>
          </div>
        </div>

        {/* Calcul */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-violet-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Calculer les provisions
            </h2>
          </div>

          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trimestre</label>
              <input
                type="text"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                placeholder="2026-Q1"
                pattern="\d{4}-Q[1-4]"
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-32"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Périmètre</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as "OPEN_ONLY" | "ALL")}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="OPEN_ONLY">Sinistres ouverts</option>
                <option value="ALL">Tous les sinistres</option>
              </select>
            </div>
            <button
              onClick={handleCompute}
              disabled={loading || !quarter.match(/^\d{4}-Q[1-4]$/)}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              {loading ? "Calcul en cours..." : "Calculer les provisions"}
            </button>
          </div>

          {computeResult && (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Best Estimate", value: fmt(computeResult.totalBE), color: "indigo" },
                { label: "SCR total", value: fmt(computeResult.totalSCR), color: "amber" },
                { label: "Risk Margin", value: fmt(computeResult.totalRM), color: "violet" },
                { label: "Sinistres", value: computeResult.claimCount.toString(), color: "cyan" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`p-4 rounded-xl border ${color === "indigo" ? "bg-indigo-50 border-indigo-200" : color === "amber" ? "bg-amber-50 border-amber-200" : color === "violet" ? "bg-violet-50 border-violet-200" : "bg-cyan-50 border-cyan-200"}`}>
                  <p className="text-lg font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rapports SolvII */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Rapports SolvII
            </h2>
          </div>
          {reportsLoading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Chargement...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/60">
                  <tr>
                    {["N° Rapport", "Trimestre", "BE total", "SCR total", "RM total", "Provisions", "Sinistres", "Généré le"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/40">
                      <td className="px-4 py-3 font-mono text-indigo-600 font-semibold">{r.reportNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{r.periodQuarter}</td>
                      <td className="px-4 py-3 text-slate-600">{fmt(r.totalBE)}</td>
                      <td className="px-4 py-3 text-amber-700">{fmt(r.totalSCR)}</td>
                      <td className="px-4 py-3 text-violet-700">{fmt(r.totalRM)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{fmt(r.totalProvisions)}</td>
                      <td className="px-4 py-3 text-slate-500">{r.claimCount}</td>
                      <td className="px-4 py-3 text-slate-400">{new Date(r.generatedAt).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Provisions détail */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Provisions par sinistre
            </h2>
            <input
              type="text"
              value={filterQuarter}
              onChange={(e) => { setFilterQuarter(e.target.value); if (e.target.value.match(/^\d{4}-Q[1-4]$/) || e.target.value === "") fetchProvisions(e.target.value); }}
              placeholder="Filtrer par trimestre (2026-Q1)"
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/60">
                <tr>
                  {["Sinistre ID", "Trimestre", "Best Estimate", "SCR", "Risk Margin", "Provision totale", "Probabilité"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {provisions.slice(0, 30).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/40">
                    <td className="px-4 py-3 font-mono text-slate-600">{p.claimId.slice(0, 12)}…</td>
                    <td className="px-4 py-3 text-slate-600">{p.periodQuarter}</td>
                    <td className="px-4 py-3 text-indigo-700">{fmt(p.bestEstimate)}</td>
                    <td className="px-4 py-3 text-amber-700">{fmt(p.scr)}</td>
                    <td className="px-4 py-3 text-violet-700">{fmt(p.riskMargin)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{fmt(p.totalProvision)}</td>
                    <td className="px-4 py-3 text-slate-500">{(p.probabilityResolution * 100).toFixed(0)}%</td>
                  </tr>
                ))}
                {provisions.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucune provision — lancez un calcul ci-dessus</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
