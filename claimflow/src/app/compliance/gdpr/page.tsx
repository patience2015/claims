"use client";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Shield, AlertTriangle, Trash2, Eye, RefreshCw } from "lucide-react";

interface ErasureRequest {
  id: string;
  policyholderId: string;
  status: string;
  requestedAt: string;
  executedAt: string | null;
  requestedBy?: { name: string; email: string };
}

interface AccessLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  accessor?: { name: string; email: string };
}

interface PurgeResult {
  dryRun: boolean;
  type: string;
  claimsDeleted: number;
  logsDeleted: number;
  cacheDeleted: number;
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
  EXECUTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export default function GdprPage() {
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Erasure form
  const [policyholderId, setPolicyholderId] = useState("");
  const [reason, setReason] = useState("");

  // Purge form
  const [purgeType, setPurgeType] = useState("ALL");
  const [dryRun, setDryRun] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/gdpr/erasure?pageSize=50");
      const json = (await res.json()) as { data: ErasureRequest[] };
      setRequests(json.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleErasure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/compliance/gdpr/erasure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyholderId, reason }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error: string };
        throw new Error(json.error);
      }
      setSuccess("Anonymisation exécutée avec succès.");
      setPolicyholderId("");
      setReason("");
      fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await fetch("/api/compliance/gdpr/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: purgeType, dryRun }),
      });
      const json = (await res.json()) as { data: PurgeResult };
      setPurgeResult(json.data);
    } finally {
      setPurging(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/compliance/gdpr/access-logs?pageSize=50");
      const json = (await res.json()) as { data: AccessLog[] };
      setLogs(json.data ?? []);
      setShowLogs(true);
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6" style={{ fontFamily: "Inter, sans-serif" }}>
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
          <div className="relative">
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Conformité</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Conformité RGPD
            </h1>
            <p className="text-indigo-200 text-sm mt-1">Droit à l&apos;oubli · Purge automatique · Logs d&apos;accès</p>
          </div>
        </div>

        {/* Droit à l'oubli */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-red-50 flex items-center justify-center">
              <Shield className="h-4 w-4 text-red-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Droit à l&apos;oubli (Art. 17 RGPD)
            </h2>
          </div>

          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl mb-5">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-medium">
              Action irréversible — toutes les données personnelles de l&apos;assuré seront anonymisées définitivement.
              Seuls les sinistres dont le statut est CLOSED ou REJECTED peuvent être anonymisés.
            </p>
          </div>

          <form onSubmit={handleErasure} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ID Assuré (cuid)</label>
              <input
                type="text"
                value={policyholderId}
                onChange={(e) => setPolicyholderId(e.target.value)}
                placeholder="cjld2cjxh0000qzrmn831i7rn"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Motif (min. 20 caractères)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Demande de suppression reçue le... par..."
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none"
                required
                minLength={20}
              />
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{success}</p>}
            <button
              type="submit"
              disabled={submitting || reason.length < 20}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {submitting ? "Anonymisation en cours..." : "Demander l'anonymisation"}
            </button>
          </form>
        </div>

        {/* Table demandes */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Historique des demandes
            </h2>
            <button onClick={fetchRequests} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Actualiser
            </button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Chargement...</div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">Aucune demande</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/60">
                  <tr>
                    {["ID Assuré", "Statut", "Demandé le", "Exécuté le", "Demandeur"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/40">
                      <td className="px-4 py-3 font-mono text-slate-600">{r.policyholderId.slice(0, 12)}…</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[r.status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{new Date(r.requestedAt).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-slate-500">{r.executedAt ? new Date(r.executedAt).toLocaleDateString("fr-FR") : "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{r.requestedBy?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Purge automatique */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Trash2 className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Purge automatique des données
            </h2>
          </div>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Type de purge</label>
              <select
                value={purgeType}
                onChange={(e) => setPurgeType(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="CLAIMS_5Y">Sinistres +5 ans</option>
                <option value="LOGS_3Y">Logs +3 ans</option>
                <option value="WEATHER_CACHE">Cache météo expiré</option>
                <option value="ALL">Tout</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="rounded" />
              Mode simulation (dry run)
            </label>
            <button
              onClick={handlePurge}
              disabled={purging}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {purging ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {dryRun ? "Simuler la purge" : "Exécuter la purge"}
            </button>
          </div>
          {purgeResult && (
            <div className={`mt-4 p-4 rounded-xl border text-sm ${purgeResult.dryRun ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
              <p className="font-semibold mb-2">{purgeResult.dryRun ? "Simulation" : "Purge effectuée"} — Type : {purgeResult.type}</p>
              <div className="grid grid-cols-4 gap-3">
                {[["Sinistres", purgeResult.claimsDeleted], ["Logs", purgeResult.logsDeleted], ["Cache", purgeResult.cacheDeleted], ["Total", purgeResult.total]].map(([k, v]) => (
                  <div key={k as string} className="text-center">
                    <div className="text-xl font-bold">{v}</div>
                    <div className="text-xs text-slate-500">{k}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Logs d'accès */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Eye className="h-4 w-4 text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                Logs d&apos;accès données personnelles
              </h2>
            </div>
            <button
              onClick={loadLogs}
              disabled={logsLoading}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
            >
              {logsLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
              Charger les logs
            </button>
          </div>
          {showLogs && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/60">
                  <tr>
                    {["Accédant", "Type entité", "ID entité", "Action", "Date"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/40">
                      <td className="px-4 py-3 text-slate-700">{l.accessor?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{l.entityType}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{l.entityId.slice(0, 12)}…</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">{l.action}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{new Date(l.createdAt).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
