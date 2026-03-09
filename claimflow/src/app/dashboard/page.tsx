"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { MainLayout } from "@/components/layout/main-layout";
import { TeamDashboard } from "@/components/dashboard/TeamDashboard";
import { Spinner } from "@/components/ui/spinner";
import { CLAIM_STATUS_LABELS, CLAIM_TYPE_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  FileText, AlertTriangle, TrendingUp, Clock, Users,
  RefreshCw, Bell, ChevronRight, Eye, Zap, Map
} from "lucide-react";
import Link from "next/link";

interface RecentClaim {
  id: string;
  claimNumber: string;
  policyholder: { firstName: string; lastName: string };
  type: string;
  estimatedAmount: number | null;
  status: string;
  createdAt: string;
}

const PERIOD_OPTIONS = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "1T" },
];

const PIE_COLORS = ["#4f46e5", "#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

type Tab = "overview" | "team";

const SLA_ALERTS = [
  { id: 1, msg: "CLM-2026-00038 — SLA dépassé de 4h", level: "critical" },
  { id: 2, msg: "CLM-2026-00031 — 1h avant dépassement SLA", level: "warning" },
  { id: 3, msg: "CLM-2026-00044 — Sinistre assigné à Julie Martin", level: "info" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState("30d");
  const canViewTeam = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [charts, setCharts] = useState<{
    timeline: { date: string; count: number; amount: number }[];
    typeDistribution: { type: string; count: number; percentage: number }[];
  } | null>(null);
  const [recentClaims, setRecentClaims] = useState<RecentClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [sr, cr, rr] = await Promise.all([
        fetch(`/api/dashboard/stats?period=${period}`),
        fetch(`/api/dashboard/charts?period=${period}`),
        fetch(`/api/claims?pageSize=5&page=1`),
      ]);
      const sd = (await sr.json()) as { data: Record<string, unknown> };
      const cd = (await cr.json()) as { data: typeof charts };
      const rd = (await rr.json()) as { data: RecentClaim[] };
      setStats(sd.data);
      setCharts(cd.data);
      setRecentClaims(rd.data || []);
      setLoading(false);
    };
    fetchData();
  }, [period]);

  const statusMap = (stats?.claimsByStatus || {}) as Record<string, number>;

  const kpis = [
    {
      title: "Total sinistres",
      value: (stats?.totalClaims as number) || 0,
      icon: FileText,
      color: "indigo",
      sub: `Période : ${period}`,
    },
    {
      title: "En attente",
      value: (stats?.pendingClaims as number) || 0,
      icon: Clock,
      color: "amber",
      sub: "Soumis + En instruction",
    },
    {
      title: "Alertes fraude",
      value: `${(stats?.fraudRate as number) || 0}%`,
      icon: AlertTriangle,
      color: "red",
      sub: "Score fraude > 70",
    },
    {
      title: "Montant estimé",
      value: formatCurrency((stats?.totalEstimatedAmount as number) || 0),
      icon: TrendingUp,
      color: "cyan",
      sub: "Somme des estimations",
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6" style={{ fontFamily: "Inter, sans-serif" }}>

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Vue d&apos;ensemble</p>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                Dashboard
              </h1>
              <p className="text-indigo-200 text-sm mt-1">Activité sinistres en temps réel</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Period selector */}
              <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/20">
                {PERIOD_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setPeriod(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      period === value
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPeriod(period)}
                className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs (Manager/Admin only) */}
        {canViewTeam && (
          <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl w-fit">
            {([
              { id: "overview" as Tab, label: "Vue globale", icon: FileText },
              { id: "team" as Tab, label: "Équipe & SLA", icon: Users },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === id
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "team" && <TeamDashboard />}

        {activeTab === "overview" && (
          loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" className="text-indigo-600" />
            </div>
          ) : (
            <>
              {/* Risk heatmap shortcut (Manager/Admin) */}
              {canViewTeam && (
                <Link href="/analytics/risk-heatmap" className="block">
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 p-5 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
                    <div className="relative flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Map className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                          Carte de risque géographique
                        </p>
                        <p className="text-indigo-100 text-xs mt-0.5">
                          Scores de risque prédictifs par zone · Alertes préventives
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-white/60 shrink-0" />
                    </div>
                  </div>
                </Link>
              )}

              {/* KPI cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map(({ title, value, icon: Icon, color, sub }) => (
                  <div
                    key={title}
                    className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                        color === "indigo" ? "bg-indigo-50 text-indigo-600" :
                        color === "amber"  ? "bg-amber-50 text-amber-600" :
                        color === "red"    ? "bg-red-50 text-red-600" :
                                            "bg-cyan-50 text-cyan-600"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${
                      color === "indigo" ? "text-indigo-700" :
                      color === "amber"  ? "text-amber-700" :
                      color === "red"    ? "text-red-600" :
                                          "text-cyan-700"
                    }`} style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                      {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
                    </p>
                    <p className="text-xs font-semibold text-slate-700 mt-1">{title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Status breakdown */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                    Répartition par statut
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Object.entries(CLAIM_STATUS_LABELS).map(([status, label]) => {
                    const count = statusMap[status] || 0;
                    return (
                      <div key={status} className="text-center bg-slate-50/60 rounded-xl p-3">
                        <div className="text-2xl font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                          {count}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Charts + SLA */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Line chart */}
                <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                      Évolution des sinistres
                    </h2>
                    <span className="text-xs text-slate-400">Claims Dynamics</span>
                  </div>
                  {charts?.timeline && charts.timeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={charts.timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { month: "short", day: "numeric" })}
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)" }}
                          labelFormatter={(v) => new Date(v as string).toLocaleDateString("fr-FR")}
                          formatter={(v: number) => [v, "Sinistres"]}
                        />
                        <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2.5} dot={false} name="Sinistres" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
                      Aucune donnée pour cette période
                    </div>
                  )}
                </div>

                {/* Pie chart */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                      Portfolio Mix
                    </h2>
                  </div>
                  {charts?.typeDistribution && charts.typeDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={charts.typeDistribution}
                          cx="50%" cy="45%"
                          outerRadius={72}
                          innerRadius={40}
                          dataKey="count"
                          nameKey="type"
                        >
                          {charts.typeDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)" }}
                          formatter={(v, name) => [v, CLAIM_TYPE_LABELS[name as keyof typeof CLAIM_TYPE_LABELS] || name]}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => (
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              {CLAIM_TYPE_LABELS[value as keyof typeof CLAIM_TYPE_LABELS] || value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
                      Aucune donnée
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Claims + Processing Power */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Recent Claims table */}
                <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                        Sinistres récents
                      </span>
                    </div>
                    <Link href="/claims" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                      Voir tout <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {recentClaims.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">Aucun sinistre récent</div>
                    ) : recentClaims.map((claim) => (
                      <Link key={claim.id} href={`/claims/${claim.id}`}>
                        <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-indigo-50/30 transition-colors cursor-pointer">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                            {claim.policyholder.firstName[0]}{claim.policyholder.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-indigo-600">{claim.claimNumber}</span>
                              <span className="text-xs text-slate-400 truncate">{claim.policyholder.firstName} {claim.policyholder.lastName}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{CLAIM_TYPE_LABELS[claim.type as keyof typeof CLAIM_TYPE_LABELS] || claim.type}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-slate-700">
                              {claim.estimatedAmount ? formatCurrency(claim.estimatedAmount) : "—"}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {CLAIM_STATUS_LABELS[claim.status as keyof typeof CLAIM_STATUS_LABELS] || claim.status}
                            </p>
                          </div>
                          <Eye className="h-4 w-4 text-slate-300 shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Processing Power widget */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-7 w-7 rounded-lg bg-cyan-50 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-cyan-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                      Processing Power
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center">
                    {/* Donut */}
                    <div className="relative h-28 w-28 mb-4">
                      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#grad)" strokeWidth="3" strokeDasharray="72, 100" strokeLinecap="round" />
                        <defs>
                          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#4f46e5" />
                            <stop offset="100%" stopColor="#06b6d4" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>72%</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Efficiency Rating</p>
                    <p className="text-xs text-slate-400 mt-1 text-center">Capacité de traitement IA optimale</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[
                      { label: "Analyse IA", pct: 89, color: "indigo" },
                      { label: "Détection fraude", pct: 76, color: "cyan" },
                      { label: "Auto-approbation", pct: 54, color: "emerald" },
                    ].map(({ label, pct, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-500">{label}</span>
                          <span className="font-semibold text-slate-700">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color === "indigo" ? "bg-indigo-500" : color === "cyan" ? "bg-cyan-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* SLA Alerts */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
                  <div className="h-7 w-7 rounded-lg bg-red-50 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-red-500" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                    Alertes SLA
                  </span>
                  <span className="ml-auto text-xs text-slate-400">{SLA_ALERTS.length} alertes</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {SLA_ALERTS.map((alert) => (
                    <div key={alert.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/40 transition-colors">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${
                        alert.level === "critical" ? "bg-red-500" :
                        alert.level === "warning"  ? "bg-amber-400" :
                        "bg-cyan-400"
                      }`} />
                      <p className="text-sm text-slate-700 flex-1">{alert.msg}</p>
                      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        )}
      </div>
    </MainLayout>
  );
}
