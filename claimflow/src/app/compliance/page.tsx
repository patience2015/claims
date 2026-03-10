"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { Spinner } from "@/components/ui/spinner";
import {
  Shield,
  Lock,
  BarChart2,
  FileSpreadsheet,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
} from "lucide-react";

interface AcprReportSummary {
  id: string;
  reportNumber: string;
  period: string;
  status: string;
  generatedAt: string | null;
}


interface SolvencyReportSummary {
  id: string;
  quarter: string;
  status: string;
  generatedAt: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  userId: string;
  userName?: string;
  createdAt: string;
  metadata?: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    GENERATED: { label: "Généré", cls: "bg-emerald-100 text-emerald-700" },
    PENDING: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
    FAILED: { label: "Échec", cls: "bg-red-100 text-red-700" },
    ARCHIVED: { label: "Archivé", cls: "bg-slate-100 text-slate-600" },
  };
  const s = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function nextFirstOfMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    ACPR_REPORT_GENERATED: "Rapport ACPR généré",
    GDPR_ERASURE_REQUESTED: "Demande d'effacement RGPD",
    GDPR_ERASURE_EXECUTED: "Effacement RGPD exécuté",
    GDPR_PURGE_EXECUTED: "Purge RGPD exécutée",
    SOLVENCY_COMPUTED: "Provisions SolvII calculées",
    COMPLIANCE_EXPORT: "Export XLSX compliance",
  };
  return map[action] ?? action;
}

export default function CompliancePage() {
  useSession();

  const [acprReport, setAcprReport] = useState<AcprReportSummary | null>(null);
  const [gdprPending, setGdprPending] = useState<number>(0);
  const [solvReport, setSolvReport] = useState<SolvencyReportSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [exportYear, setExportYear] = useState<string>(new Date().getFullYear().toString());
  const [exportQuarter, setExportQuarter] = useState<string>("Q1");

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [acprRes, gdprRes, solvRes, auditRes] = await Promise.allSettled([
          fetch("/api/compliance/acpr/reports?pageSize=1"),
          fetch("/api/compliance/gdpr/erasure?status=PENDING&pageSize=1"),
          fetch("/api/compliance/solvency/reports?pageSize=1"),
          fetch("/api/audit-logs?action=ACPR_REPORT_GENERATED,GDPR_ERASURE_REQUESTED,GDPR_PURGE_EXECUTED,SOLVENCY_COMPUTED,COMPLIANCE_EXPORT&pageSize=8"),
        ]);

        if (acprRes.status === "fulfilled" && acprRes.value.ok) {
          const d = await acprRes.value.json() as { data?: AcprReportSummary[] };
          setAcprReport(d.data?.[0] ?? null);
        }
        if (gdprRes.status === "fulfilled" && gdprRes.value.ok) {
          const d = await gdprRes.value.json() as { total?: number; data?: unknown[] };
          setGdprPending(d.total ?? d.data?.length ?? 0);
        }
        if (solvRes.status === "fulfilled" && solvRes.value.ok) {
          const d = await solvRes.value.json() as { data?: SolvencyReportSummary[] };
          setSolvReport(d.data?.[0] ?? null);
        }
        if (auditRes.status === "fulfilled" && auditRes.value.ok) {
          const d = await auditRes.value.json() as { data?: AuditLogEntry[] };
          setAuditLogs(d.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1].map(String);

  return (
    <MainLayout>
      <div className="space-y-6" style={{ fontFamily: "Inter, sans-serif" }}>

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
          <div className="relative">
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">
              Audit Réglementaire
            </p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Conformité Réglementaire
            </h1>
            <p className="text-indigo-200 text-sm mt-1">
              ACPR · RGPD · Solvabilité II · Export Audit
            </p>
          </div>
        </div>

        {/* Module grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Card ACPR */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                      Rapports ACPR
                    </h2>
                    <p className="text-xs text-slate-400">Autorité de Contrôle Prudentiel</p>
                  </div>
                </div>
                {acprReport && <StatusBadge status={acprReport.status} />}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50/60 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 mb-1">Dernier rapport</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {acprReport ? acprReport.period : "—"}
                  </p>
                  <p className="text-[11px] text-slate-400">{formatDate(acprReport?.generatedAt)}</p>
                </div>
                <div className="bg-slate-50/60 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 mb-1">Prochain rapport</p>
                  <p className="text-sm font-semibold text-slate-700">{nextFirstOfMonth()}</p>
                  <p className="text-[11px] text-slate-400">Génération automatique</p>
                </div>
              </div>
              <Link
                href="/compliance/acpr"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                Voir les rapports <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Card RGPD */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-cyan-50 flex items-center justify-center">
                    <Lock className="h-6 w-6 text-cyan-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                      RGPD
                    </h2>
                    <p className="text-xs text-slate-400">Protection des données personnelles</p>
                  </div>
                </div>
                {gdprPending > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    {gdprPending} en attente
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50/60 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 mb-1">Purge automatique</p>
                  <p className="text-sm font-semibold text-slate-700">Activée</p>
                  <p className="text-[11px] text-slate-400">Données &gt; 5 ans</p>
                </div>
                <div className="bg-slate-50/60 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 mb-1">Logs d&apos;accès</p>
                  <p className="text-sm font-semibold text-slate-700">Traçabilité</p>
                  <p className="text-[11px] text-slate-400">Audit complet</p>
                </div>
              </div>
              <Link
                href="/compliance/gdpr"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 transition-colors"
              >
                Gérer <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Card SolvII */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-violet-50 flex items-center justify-center">
                    <BarChart2 className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                      Solvabilité II
                    </h2>
                    <p className="text-xs text-slate-400">Provisions techniques prudentielles</p>
                  </div>
                </div>
                {solvReport && <StatusBadge status={solvReport.status} />}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50/60 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 mb-1">Dernier rapport</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {solvReport ? solvReport.quarter : "—"}
                  </p>
                  <p className="text-[11px] text-slate-400">{formatDate(solvReport?.generatedAt)}</p>
                </div>
                <div className="bg-slate-50/60 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 mb-1">Norme</p>
                  <p className="text-sm font-semibold text-slate-700">SolvII / IFRS 17</p>
                  <p className="text-[11px] text-slate-400">Best Estimate + SCR</p>
                </div>
              </div>
              <Link
                href="/compliance/solvency"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
              >
                Recalculer <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Card Export Excel */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                    Export Excel
                  </h2>
                  <p className="text-xs text-slate-400">Export XLSX multi-feuilles complet</p>
                </div>
              </div>
              <div className="flex gap-3">
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  value={exportQuarter}
                  onChange={(e) => setExportQuarter(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Q1">T1</option>
                  <option value="Q2">T2</option>
                  <option value="Q3">T3</option>
                  <option value="Q4">T4</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/compliance/export"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-colors"
                >
                  Options avancées
                </Link>
                <a
                  href={`/api/compliance/export/xlsx?year=${exportYear}&quarter=${exportQuarter}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Télécharger XLSX
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Recent activity timeline */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Clock className="h-4 w-4 text-indigo-600" />
            </div>
            <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Activité récente — Compliance
            </span>
          </div>
          {auditLogs.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              Aucune activité compliance enregistrée
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {auditLogs.map((log) => {
                const icon = log.action.startsWith("ACPR")
                  ? { Icon: Shield, color: "text-indigo-500", bg: "bg-indigo-50" }
                  : log.action.startsWith("GDPR")
                  ? { Icon: Lock, color: "text-cyan-500", bg: "bg-cyan-50" }
                  : log.action.startsWith("SOLVENCY")
                  ? { Icon: BarChart2, color: "text-violet-500", bg: "bg-violet-50" }
                  : log.action.startsWith("COMPLIANCE")
                  ? { Icon: FileText, color: "text-emerald-500", bg: "bg-emerald-50" }
                  : { Icon: Calendar, color: "text-slate-400", bg: "bg-slate-50" };
                return (
                  <div key={log.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/40 transition-colors">
                    <div className={`h-8 w-8 rounded-lg ${icon.bg} flex items-center justify-center shrink-0`}>
                      <icon.Icon className={`h-4 w-4 ${icon.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{actionLabel(log.action)}</p>
                      {log.userName && (
                        <p className="text-[11px] text-slate-400">par {log.userName}</p>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">
                      {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick status row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Conformité ACPR",
              status: acprReport?.status === "GENERATED" ? "Conforme" : "À vérifier",
              ok: acprReport?.status === "GENERATED",
              sub: "Dernier rapport validé",
            },
            {
              label: "RGPD",
              status: gdprPending === 0 ? "À jour" : `${gdprPending} demande(s) en attente`,
              ok: gdprPending === 0,
              sub: "Droit à l'effacement",
            },
            {
              label: "Solvabilité II",
              status: solvReport?.status === "GENERATED" ? "Conforme" : "À recalculer",
              ok: solvReport?.status === "GENERATED",
              sub: "Provisions techniques",
            },
          ].map(({ label, status, ok, sub }) => (
            <div key={label} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4 flex items-center gap-3">
              {ok
                ? <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                : <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />}
              <div>
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className={`text-xs font-medium ${ok ? "text-emerald-600" : "text-amber-600"}`}>{status}</p>
                <p className="text-[11px] text-slate-400">{sub}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </MainLayout>
  );
}
