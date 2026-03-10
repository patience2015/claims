"use client";
import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { FileSpreadsheet, Download, Info } from "lucide-react";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const MONTHS = [
  { value: 1, label: "Janvier" }, { value: 2, label: "Février" }, { value: 3, label: "Mars" },
  { value: 4, label: "Avril" }, { value: 5, label: "Mai" }, { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" }, { value: 8, label: "Août" }, { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" }, { value: 11, label: "Novembre" }, { value: 12, label: "Décembre" },
];
const CLAIM_TYPES = [
  { value: "ALL", label: "Tous les types" },
  { value: "COLLISION", label: "Collision" },
  { value: "THEFT", label: "Vol" },
  { value: "VANDALISM", label: "Vandalisme" },
  { value: "GLASS", label: "Bris de glace" },
  { value: "FIRE", label: "Incendie" },
  { value: "NATURAL_DISASTER", label: "Catastrophe naturelle" },
  { value: "BODILY_INJURY", label: "Dommages corporels" },
  { value: "OTHER", label: "Autre" },
];

export default function ExportPage() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("quarter");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState("Q1");
  const [claimType, setClaimType] = useState("ALL");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period, year: String(year), claimType });
      if (period === "month") params.set("month", String(month));
      if (period === "quarter") params.set("quarter", quarter);

      const res = await fetch(`/api/compliance/export/xlsx?${params.toString()}`);
      if (!res.ok) {
        const json = (await res.json()) as { error: string };
        throw new Error(json.error);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("content-disposition") ?? "";
      const filename = cd.match(/filename="(.+)"/)?.[1] ?? `claimflow-audit-${year}.xlsx`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la génération");
    } finally {
      setDownloading(false);
    }
  };

  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

  return (
    <MainLayout>
      <div className="space-y-6" style={{ fontFamily: "Inter, sans-serif" }}>
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
          <div className="relative">
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Conformité · Audit</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Export Excel — Commissaire aux comptes
            </h1>
            <p className="text-indigo-200 text-sm mt-1">Génération du fichier XLSX multi-feuilles protégé</p>
          </div>
        </div>

        {/* Info feuilles */}
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-800 mb-2">Contenu du fichier XLSX</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "Sinistres", desc: "N°, date, type, statut, assuré, montants, fraude" },
                  { label: "Provisions SolvII", desc: "BE, SCR, Risk Margin par sinistre" },
                  { label: "Fraude", desc: "Score, risque, réseau suspect" },
                  { label: "RGPD", desc: "Purges effectuées, droits à l'oubli" },
                  { label: "Rapport SolvII", desc: "Totaux BE/SCR/RM par trimestre" },
                ].map(({ label, desc }) => (
                  <div key={label} className="bg-white rounded-xl p-3 border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700 mb-1">{label}</p>
                    <p className="text-[10px] text-slate-500">{desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-indigo-600 mt-2 flex items-center gap-1">
                🔒 Fichier protégé en lecture seule — cellules verrouillées
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Paramètres d&apos;export
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Période */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Période</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as "month" | "quarter" | "year")}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="month">Mensuel</option>
                <option value="quarter">Trimestriel</option>
                <option value="year">Annuel</option>
              </select>
            </div>

            {/* Année */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Année</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Mois ou Trimestre */}
            {period === "month" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mois</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}

            {period === "quarter" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trimestre</label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            )}

            {/* Type sinistre */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Type de sinistre</label>
              <select
                value={claimType}
                onChange={(e) => setClaimType(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {CLAIM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            {downloading
              ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Génération en cours...</>
              : <><Download className="h-4 w-4" /> Générer &amp; Télécharger le XLSX</>
            }
          </button>

          <p className="mt-3 text-[11px] text-slate-400">
            Le fichier sera automatiquement téléchargé au format <code>.xlsx</code> compatible Excel et LibreOffice.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
