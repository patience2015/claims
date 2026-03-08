"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { MainLayout } from "@/components/layout/main-layout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { TeamDashboard } from "@/components/dashboard/TeamDashboard";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLAIM_STATUS_LABELS, CLAIM_TYPE_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { FileText, AlertTriangle, TrendingUp, Clock, Users } from "lucide-react";

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "90 derniers jours" },
];

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

type Tab = "overview" | "team";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [sr, cr] = await Promise.all([
        fetch(`/api/dashboard/stats?period=${period}`),
        fetch(`/api/dashboard/charts?period=${period}`),
      ]);
      const sd = await sr.json();
      const cd = await cr.json();
      setStats(sd.data);
      setCharts(cd.data);
      setLoading(false);
    };
    fetchData();
  }, [period]);

  const statusMap = (stats?.claimsByStatus || {}) as Record<string, number>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Vue d&apos;ensemble de l&apos;activité sinistres</p>
          </div>
          {activeTab === "overview" && (
            <Select options={PERIOD_OPTIONS} value={period} onChange={e => setPeriod(e.target.value)} className="w-48" placeholder="Période" />
          )}
        </div>

        {/* Tabs */}
        {canViewTeam && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {([
              { id: "overview", label: "Vue globale", icon: FileText },
              { id: "team", label: "Équipe & SLA", icon: Users },
            ] as { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "team" && <TeamDashboard />}

        {activeTab === "overview" && loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" className="text-blue-600" /></div>
        ) : activeTab === "overview" && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title="Total sinistres" value={stats?.totalClaims as number || 0} icon={FileText} description={`Période : ${period}`} />
              <StatsCard title="En attente" value={stats?.pendingClaims as number || 0} icon={Clock} description="Soumis + En instruction + Infos demandées" />
              <StatsCard title="Taux de fraude" value={`${stats?.fraudRate as number || 0}%`} icon={AlertTriangle} description="Dossiers score fraude > 70" />
              <StatsCard title="Montant estimé total" value={formatCurrency(stats?.totalEstimatedAmount as number || 0)} icon={TrendingUp} description="Somme des estimations" />
            </div>

            {/* Status breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(CLAIM_STATUS_LABELS).map(([status, label]) => (
                <Card key={status} className="text-center">
                  <CardContent className="pt-4 pb-4">
                    <div className="text-2xl font-bold text-gray-900">{statusMap[status] || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Évolution des sinistres</CardTitle></CardHeader>
                <CardContent>
                  {charts?.timeline && charts.timeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={charts.timeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={v => new Date(v).toLocaleDateString("fr-FR", { month: "short", day: "numeric" })} tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip labelFormatter={v => new Date(v as string).toLocaleDateString("fr-FR")} formatter={(v: number) => [v, "Sinistres"]} />
                        <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sinistres" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-gray-400">Aucune donnée pour cette période</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Répartition par type</CardTitle></CardHeader>
                <CardContent>
                  {charts?.typeDistribution && charts.typeDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={charts.typeDistribution} cx="50%" cy="50%" outerRadius={80} dataKey="count" nameKey="type">
                          {charts.typeDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [v, CLAIM_TYPE_LABELS[name as keyof typeof CLAIM_TYPE_LABELS] || name]} />
                        <Legend formatter={value => CLAIM_TYPE_LABELS[value as keyof typeof CLAIM_TYPE_LABELS] || value} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-gray-400">Aucune donnée pour cette période</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
