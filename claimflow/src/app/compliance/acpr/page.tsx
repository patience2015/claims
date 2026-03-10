"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { Spinner } from "@/components/ui/spinner";
import {
  Shield,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";

interface AcprConfig {
  headerTitle: string;
  headerSubtitle: string;
  sections: {
    summary: boolean;
    fraud: boolean;
    provisions: boolean;
    incidents: boolean;
  };
  footerText: string;
}

interface AcprReport {
  id: string;
  reportNumber: string;
  period: string;
  status: string;
  generatedAt: string | null;
  hashSha256: string | null;
  generatedBy?: { name: string } | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  GENERATED: { label: "Généré", cls: "bg-emerald-100 text-emerald-700" },
  ARCHIVED: { label: "Archivé", cls: "bg-slate-100 text-slate-600" },
  FAILED: { label: "Échec", cls: "bg-red-100 text-red-700" },
};

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DEFAULT_CONFIG: AcprConfig = {
  headerTitle: "Rapport ACPR — ClaimFlow AI",
  headerSubtitle: "Rapport prudentiel mensuel d'activité sinistres",
  sections: { summary: true, fraud: true, provisions: true, incidents: true },
  footerText: "Document confidentiel — Usage réglementaire uniquement",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AcprPage() {
  useSession();

  // Config state
  const [config, setConfig] = useState<AcprConfig>(DEFAULT_CONFIG);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  // Generate state
  const currentYear = new Date().getFullYear();
  const [genYear, setGenYear] = useState<string>(currentYear.toString());
  const [genMonth, setGenMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  // Reports table state
  const [reports, setReports] = useState<AcprReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [loadingReports, setLoadingReports] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`/api/compliance/acpr/reports?page=${page}&pageSize=${PAGE_SIZE}`);
      if (res.ok) {
        const d = await res.json() as { data?: AcprReport[]; total?: number };
        setReports(d.data ?? []);
        setTotal(d.total ?? 0);
      }
    } finally {
      setLoadingReports(false);
    }
  }, [page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Load config
  useEffect(() => {
    fetch("/api/compliance/acpr/config")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.data) setConfig(d.data as AcprConfig); })
      .catch(() => null);
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      const res = await fetch("/api/compliance/acpr/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setConfigMsg(res.ok ? "Configuration sauvegardée" : "Erreur lors de la sauvegarde");
    } catch {
      setConfigMsg("Erreur réseau");
    } finally {
      setConfigSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMsg(null);
    try {
      const res = await fetch("/api/compliance/acpr/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: parseInt(genYear), month: parseInt(genMonth) }),
      });
      const d = await res.json() as { message?: string; error?: string };
      setGenMsg(res.ok ? (d.message ?? "Rapport généré avec succès") : (d.error ?? "Erreur de génération"));
      if (res.ok) await fetchReports();
    } catch {
      setGenMsg("Erreur réseau");
    } finally {
      setGenerating(false);
    }
  };

  const years = [currentYear - 2, currentYear - 1, currentYear].map(String);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <MainLayout>
      <div className="space-y-6" style={{ fontFamily: "Inter, sans-serif" }}>

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
          <div className="relative flex items-center gap-4">
            <Link href="/compliance" className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Conformité ACPR</p>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                Rapports ACPR
              </h1>
              <p className="text-indigo-200 text-sm mt-1">Autorité de Contrôle Prudentiel et de Résolution</p>
            </div>
            <div className="ml-auto h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        {/* Config template (collapsible) */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl overflow-hidden">
          <button
            onClick={() => setConfigOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                Configuration du template de rapport
              </span>
            </div>
            {configOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          {configOpen && (
            <form onSubmit={handleSaveConfig} className="px-6 pb-6 space-y-4 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titre du rapport</label>
                  <input
                    type="text"
                    value={config.headerTitle}
                    onChange={(e) => setConfig({ ...config, headerTitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sous-titre</label>
                  <input
                    type="text"
                    value={config.headerSubtitle}
                    onChange={(e) => setConfig({ ...config, headerSubtitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Sections incluses</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: "summary", label: "Résumé exécutif" },
                    { key: "fraud", label: "Détection fraude" },
                    { key: "provisions", label: "Provisions SolvII" },
                    { key: "incidents", label: "Incidents déclarés" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.sections[key as keyof typeof config.sections]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            sections: { ...config.sections, [key]: e.target.checked },
                          })
                        }
                        className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pied de page</label>
                <input
                  type="text"
                  value={config.footerText}
                  onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {configSaving ? <Spinner size="sm" className="text-white" /> : null}
                  Sauvegarder la configuration
                </button>
                {configMsg && (
                  <span className={`text-sm font-medium ${configMsg.includes("Erreur") ? "text-red-600" : "text-emerald-600"}`}>
                    {configMsg}
                  </span>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Generate section */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Générer un rapport
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Année</label>
              <select
                value={genYear}
                onChange={(e) => setGenYear(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mois</label>
              <select
                value={genMonth}
                onChange={(e) => setGenMonth(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={String(i + 1)}>{m}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {generating ? <Spinner size="sm" className="text-white" /> : <Shield className="h-4 w-4" />}
              Générer
            </button>
            {genMsg && (
              <span className={`text-sm font-medium ${genMsg.includes("Erreur") ? "text-red-600" : "text-emerald-600"}`}>
                {genMsg}
              </span>
            )}
          </div>
        </div>

        {/* Reports table */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <FileText className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                Historique des rapports
              </span>
            </div>
            <span className="text-xs text-slate-400">{total} rapport(s)</span>
          </div>

          {loadingReports ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" className="text-indigo-600" />
            </div>
          ) : reports.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">Aucun rapport généré</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/60 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3 text-left">Rapport</th>
                    <th className="px-6 py-3 text-left">Période</th>
                    <th className="px-6 py-3 text-left">Généré le</th>
                    <th className="px-6 py-3 text-left">Statut</th>
                    <th className="px-6 py-3 text-left">Hash SHA-256</th>
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {reports.map((report) => {
                    const badge = STATUS_BADGE[report.status] ?? { label: report.status, cls: "bg-slate-100 text-slate-600" };
                    return (
                      <tr key={report.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-bold text-indigo-600">{report.reportNumber}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{report.period}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs">{formatDate(report.generatedAt)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {report.hashSha256 ? (
                            <span className="font-mono text-xs text-slate-400" title={report.hashSha256}>
                              {report.hashSha256.slice(0, 16)}…
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          {report.status === "GENERATED" && (
                            <a
                              href={`/api/compliance/acpr/reports/${report.id}/download`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Télécharger
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Précédent
              </button>
              <span className="text-xs text-slate-500">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Suivant <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
