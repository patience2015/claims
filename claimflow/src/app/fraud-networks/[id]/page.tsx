"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { FraudNetworkBadge } from "@/components/fraud-network/FraudNetworkBadge";
import { FraudNetworkGraph } from "@/components/fraud-network/FraudNetworkGraph";
import { FraudNetworkDetail } from "@/types";
import {
  Network,
  AlertTriangle,
  Users,
  FileText,
  ArrowLeft,
  XCircle,
  ShieldAlert,
  BarChart2,
  Clock,
  ExternalLink,
  CheckCircle,
} from "lucide-react";

type Tab = "graph" | "claims" | "history";

const TAB_ITEMS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "graph", label: "Graphe", icon: Network },
  { id: "claims", label: "Sinistres", icon: FileText },
  { id: "history", label: "Historique", icon: Clock },
];

const CLAIM_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Soumis",
  UNDER_REVIEW: "En instruction",
  INFO_REQUESTED: "Infos demandées",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  CLOSED: "Clôturé",
};

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: "red" | "orange" | "blue" | "indigo" | "slate";
}) {
  const colorMap: Record<string, string> = {
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    slate: "bg-slate-100 text-slate-500",
  };
  const textMap: Record<string, string> = {
    red: "text-red-700",
    orange: "text-orange-700",
    blue: "text-blue-700",
    indigo: "text-indigo-700",
    slate: "text-slate-700",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className={`text-2xl font-bold ${textMap[color]}`} style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
        {value}
      </p>
      <p className="text-xs font-semibold text-slate-700 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  withNotes?: boolean;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmVariant = "default",
  withNotes = false,
  onConfirm,
  onCancel,
  loading,
}: ConfirmModalProps) {
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <h2 className="text-base font-semibold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-4">{description}</p>
        {withNotes && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notes <span className="text-slate-400">(optionnel)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Motif, observations…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button
            size="sm"
            variant={confirmVariant}
            onClick={() => onConfirm(notes)}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" className="mr-2" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function FraudNetworkDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [network, setNetwork] = useState<FraudNetworkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("graph");
  const [modal, setModal] = useState<"dismiss" | "escalate" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<{ label: string; type: string; claimCount: number } | null>(null);

  const role = session?.user?.role;

  // Auth guard
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session || (role !== "MANAGER" && role !== "ADMIN")) {
      router.replace("/claims");
    }
  }, [session, sessionStatus, role, router]);

  const fetchNetwork = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/fraud-networks/${id}`);
      if (!res.ok) throw new Error("Réseau introuvable");
      const json = (await res.json()) as { data: FraudNetworkDetail };
      setNetwork(json.data);
    } catch {
      setNetwork(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (role === "MANAGER" || role === "ADMIN") {
      fetchNetwork();
    }
  }, [fetchNetwork, role]);

  const handleAction = async (action: "DISMISS" | "ESCALATE", notes: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/fraud-networks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Erreur lors de l'action");
      }
      setModal(null);
      await fetchNetwork();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setActionLoading(false);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-24">
          <Spinner size="lg" className="text-indigo-600" />
        </div>
      </MainLayout>
    );
  }

  if (!network) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Réseau introuvable</h2>
          <p className="text-sm text-slate-400 mb-6">Ce réseau n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
          <Link href="/fraud-networks">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la liste
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const canActOnNetwork =
    network.status !== "DISMISSED" && network.status !== "INACTIVE";

  return (
    <MainLayout>
      {/* Modals */}
      {modal === "dismiss" && (
        <ConfirmModal
          title="Marquer comme faux positif"
          description="Ce réseau sera classé comme DISMISSED. Cette action peut être révisée."
          confirmLabel="Confirmer le rejet"
          confirmVariant="default"
          withNotes
          onConfirm={(notes) => handleAction("DISMISS", notes)}
          onCancel={() => setModal(null)}
          loading={actionLoading}
        />
      )}
      {modal === "escalate" && (
        <ConfirmModal
          title="Escalader ce réseau"
          description="Ce réseau passera en statut CRITICAL et sera mis en investigation prioritaire."
          confirmLabel="Escalader"
          confirmVariant="destructive"
          withNotes
          onConfirm={(notes) => handleAction("ESCALATE", notes)}
          onCancel={() => setModal(null)}
          loading={actionLoading}
        />
      )}

      <div className="space-y-6">
        {/* Back link */}
        <div>
          <Link
            href="/fraud-networks"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux réseaux suspects
          </Link>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                  <Network className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1
                      className="text-xl font-bold text-slate-900"
                      style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}
                    >
                      {network.networkNumber}
                    </h1>
                    <FraudNetworkBadge status={network.status} />
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    Créé le{" "}
                    {new Date(network.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {network.notes && (
                    <p className="text-sm text-slate-600 mt-2 italic">
                      &quot;{network.notes}&quot;
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {canActOnNetwork && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModal("dismiss")}
                    className="border-gray-200 text-gray-600 hover:border-gray-300"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Faux positif
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setModal("escalate")}
                  >
                    <ShieldAlert className="h-4 w-4 mr-1.5" />
                    Escalader
                  </Button>
                </div>
              )}
              {network.status === "DISMISSED" && (
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Classé faux positif
                </span>
              )}
            </div>

            {/* Error */}
            {actionError && (
              <div className="mt-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {actionError}
              </div>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard label="Nœuds" value={network.nodeCount} icon={Users} color="indigo" />
          <MetricCard label="Sinistres" value={network.claimCount} icon={FileText} color="blue" />
          <MetricCard
            label="Score moyen fraude"
            value={`${Math.round(network.avgFraudScore)}/100`}
            icon={AlertTriangle}
            color={network.avgFraudScore >= 70 ? "red" : network.avgFraudScore >= 40 ? "orange" : "slate"}
          />
          <MetricCard
            label="Score réseau"
            value={`${network.networkScore}/100`}
            icon={BarChart2}
            color={network.networkScore >= 80 ? "red" : network.networkScore >= 60 ? "orange" : "blue"}
          />
          <MetricCard
            label="Densité"
            value={`${(network.density * 100).toFixed(1)}%`}
            icon={Network}
            color="slate"
            sub="Connections / max possible"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tab nav */}
          <div className="flex gap-0 border-b border-slate-100">
            {TAB_ITEMS.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tabId
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50/30"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {/* Graph tab */}
            {activeTab === "graph" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {network.nodes.length} nœud{network.nodes.length !== 1 ? "s" : ""} ·{" "}
                    {network.links.length} lien{network.links.length !== 1 ? "s" : ""}
                  </p>
                  {selectedNode && (
                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-semibold text-indigo-700">{selectedNode.label}</span>
                      <span className="text-indigo-400">·</span>
                      <span className="text-indigo-500">{selectedNode.type}</span>
                      <span className="text-indigo-400">·</span>
                      <span className="text-indigo-500">{selectedNode.claimCount} sinistre(s)</span>
                      <button
                        onClick={() => setSelectedNode(null)}
                        className="ml-1 text-indigo-400 hover:text-indigo-600"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                <FraudNetworkGraph
                  nodes={network.nodes}
                  links={network.links.map((l) => ({
                    sourceKey: l.sourceKey,
                    targetKey: l.targetKey,
                    weight: l.weight,
                  }))}
                  onNodeClick={(node) =>
                    setSelectedNode({
                      label: node.label,
                      type: node.type,
                      claimCount: node.claimCount,
                    })
                  }
                />
              </div>
            )}

            {/* Claims tab */}
            {activeTab === "claims" && (
              <div>
                {network.claims.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    Aucun sinistre associé à ce réseau.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            N° sinistre
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Statut
                          </th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Score fraude
                          </th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Score réseau
                          </th>
                          <th className="py-3 px-4" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {network.claims.map((claim) => (
                          <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-mono text-xs font-bold text-indigo-600">
                                {claim.claimNumber}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs text-slate-600">
                                {CLAIM_STATUS_LABELS[claim.status] ?? claim.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {claim.fraudScore !== null ? (
                                <span
                                  className={`text-sm font-semibold ${
                                    claim.fraudScore >= 70
                                      ? "text-red-600"
                                      : claim.fraudScore >= 40
                                      ? "text-orange-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {claim.fraudScore}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {claim.networkScore !== null ? (
                                <span className="text-sm font-semibold text-slate-700">
                                  {claim.networkScore}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link
                                href={`/claims/${claim.id}`}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                Voir
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* History tab */}
            {activeTab === "history" && (
              <div>
                {!network.auditTrail || network.auditTrail.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    Aucun historique disponible pour ce réseau.
                  </div>
                ) : (
                  <ol className="relative border-l border-slate-200 ml-3 space-y-6">
                    {network.auditTrail.map((entry) => (
                      <li key={entry.id} className="ml-6">
                        <span className="absolute -left-2.5 h-5 w-5 rounded-full bg-white border-2 border-indigo-300 flex items-center justify-center">
                          <Clock className="h-2.5 w-2.5 text-indigo-400" />
                        </span>
                        <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                          <p className="text-xs font-semibold text-slate-700">
                            {entry.action}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Par <span className="font-medium">{entry.userName}</span>
                            {" · "}
                            {new Date(entry.createdAt).toLocaleString("fr-FR")}
                          </p>
                          {entry.metadata && (
                            <p className="text-xs text-slate-500 mt-1 italic">&quot;{entry.metadata}&quot;</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
