"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { FraudNetworkBadge } from "@/components/fraud-network/FraudNetworkBadge";
import { FraudNetworkItem, FraudNetworkStatus } from "@/types";
import {
  Network,
  AlertTriangle,
  Eye,
  RefreshCw,
  Shield,
  Users,
  FileText,
  TrendingUp,
} from "lucide-react";

type FilterStatus = "ALL" | FraudNetworkStatus;

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "CRITICAL", label: "Critique" },
  { value: "SUSPECT", label: "Suspect" },
  { value: "UNDER_INVESTIGATION", label: "En investigation" },
  { value: "DISMISSED", label: "Faux positif" },
];

function NetworkScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 80
      ? "bg-red-500"
      : pct >= 60
      ? "bg-orange-500"
      : pct >= 40
      ? "bg-yellow-500"
      : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-8 text-right">{pct}</span>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Shield className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">
        {filtered ? "Aucun réseau pour ce filtre" : "Aucun réseau suspect détecté"}
      </h3>
      <p className="text-sm text-slate-400 max-w-sm">
        {filtered
          ? "Modifiez le filtre pour voir d'autres réseaux."
          : "Le système n'a pas encore identifié de réseaux de fraude potentiels."}
      </p>
    </div>
  );
}

export default function FraudNetworksPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [networks, setNetworks] = useState<FraudNetworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");

  const role = session?.user?.role;

  // Auth guard — MANAGER and ADMIN only
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session || (role !== "MANAGER" && role !== "ADMIN")) {
      router.replace("/claims");
    }
  }, [session, sessionStatus, role, router]);

  const fetchNetworks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") {
        params.set("status", filterStatus);
      } else {
        params.set("status", "SUSPECT,CRITICAL,UNDER_INVESTIGATION,ACTIVE,DISMISSED,INACTIVE");
      }
      const res = await fetch(`/api/fraud-networks?${params.toString()}`);
      if (!res.ok) throw new Error("Erreur chargement");
      const json = (await res.json()) as { data: FraudNetworkItem[] };
      setNetworks(json.data ?? []);
    } catch {
      setNetworks([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (role === "MANAGER" || role === "ADMIN") {
      fetchNetworks();
    }
  }, [fetchNetworks, role]);

  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && role !== "MANAGER" && role !== "ADMIN")) {
    return (
      <MainLayout>
        <div className="flex justify-center py-24">
          <Spinner size="lg" className="text-indigo-600" />
        </div>
      </MainLayout>
    );
  }

  const filtered =
    filterStatus === "ALL"
      ? networks
      : networks.filter((n) => n.status === filterStatus);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-red-100 text-xs font-medium uppercase tracking-wider mb-1">
                Détection fraude
              </p>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                Réseaux suspects
              </h1>
              <p className="text-red-100 text-sm mt-1">
                Visualisation et gestion des réseaux de fraude potentiels
              </p>
            </div>
            <button
              onClick={fetchNetworks}
              disabled={loading}
              className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-50"
              title="Actualiser"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        {!loading && networks.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Total réseaux",
                value: networks.length,
                icon: Network,
                color: "indigo",
              },
              {
                label: "Critiques",
                value: networks.filter((n) => n.status === "CRITICAL").length,
                icon: AlertTriangle,
                color: "red",
              },
              {
                label: "En investigation",
                value: networks.filter((n) => n.status === "UNDER_INVESTIGATION").length,
                icon: Shield,
                color: "blue",
              },
              {
                label: "Suspects",
                value: networks.filter((n) => n.status === "SUSPECT").length,
                icon: TrendingUp,
                color: "orange",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4"
              >
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${
                    color === "red"
                      ? "bg-red-50 text-red-600"
                      : color === "blue"
                      ? "bg-blue-50 text-blue-600"
                      : color === "orange"
                      ? "bg-orange-50 text-orange-600"
                      : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p
                  className={`text-2xl font-bold ${
                    color === "red"
                      ? "text-red-700"
                      : color === "blue"
                      ? "text-blue-700"
                      : color === "orange"
                      ? "text-orange-700"
                      : "text-indigo-700"
                  }`}
                  style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}
                >
                  {value}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-slate-500 mr-1">Filtrer :</span>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                filterStatus === opt.value
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filtered={filterStatus !== "ALL"} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((network) => (
              <NetworkCard key={network.id} network={network} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function NetworkCard({ network }: { network: FraudNetworkItem }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="font-mono text-sm font-bold text-slate-800"
              style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}
            >
              {network.networkNumber}
            </span>
          </div>
          <FraudNetworkBadge status={network.status} />
        </div>
        <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
          <Network className="h-5 w-5 text-red-500" />
        </div>
      </div>

      {/* Metrics */}
      <div className="px-5 py-4 space-y-3 flex-1">
        {/* Network score bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Score réseau</span>
          </div>
          <NetworkScoreBar score={network.networkScore} />
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="text-center bg-slate-50 rounded-lg py-2">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p
              className="text-lg font-bold text-slate-800"
              style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}
            >
              {network.nodeCount}
            </p>
            <p className="text-[10px] text-slate-400">Nœuds</p>
          </div>
          <div className="text-center bg-slate-50 rounded-lg py-2">
            <div className="flex items-center justify-center mb-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p
              className="text-lg font-bold text-slate-800"
              style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}
            >
              {network.claimCount}
            </p>
            <p className="text-[10px] text-slate-400">Sinistres</p>
          </div>
          <div className="text-center bg-slate-50 rounded-lg py-2">
            <div className="flex items-center justify-center mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p
              className={`text-lg font-bold ${
                network.avgFraudScore >= 70
                  ? "text-red-600"
                  : network.avgFraudScore >= 40
                  ? "text-orange-600"
                  : "text-green-600"
              }`}
              style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}
            >
              {Math.round(network.avgFraudScore)}
            </p>
            <p className="text-[10px] text-slate-400">Fraude moy.</p>
          </div>
        </div>

        {/* Created at */}
        <p className="text-[11px] text-slate-400">
          Créé le{" "}
          {new Date(network.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Action */}
      <div className="px-5 pb-5">
        <Link href={`/fraud-networks/${network.id}`} className="block">
          <Button className="w-full" variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Voir le graphe
          </Button>
        </Link>
      </div>
    </div>
  );
}
