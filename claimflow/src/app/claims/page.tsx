"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  ClaimStatus,
  ClaimType,
} from "@/types";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Plus, Search, Filter, AlertTriangle, Download, ChevronLeft, ChevronRight, Eye, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";

interface Claim {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  type: ClaimType;
  description: string;
  incidentDate: string;
  incidentLocation: string;
  fraudScore: number | null;
  estimatedAmount: number | null;
  policyholder: {
    firstName: string;
    lastName: string;
    vehicleMake: string;
    vehicleModel: string;
  };
  assignedTo: { name: string } | null;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  ...Object.entries(CLAIM_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const TYPE_OPTIONS = [
  { value: "", label: "Tous les types" },
  ...Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const FRAUD_OPTIONS = [
  { value: "", label: "Tous les scores" },
  { value: "high", label: "Élevé (≥70)" },
  { value: "medium", label: "Moyen (40-69)" },
  { value: "low", label: "Faible (<40)" },
];

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  SUBMITTED:  { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400" },
  IN_REVIEW:  { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  ANALYZED:   { bg: "bg-purple-50",  text: "text-purple-700",  dot: "bg-purple-400" },
  APPROVED:   { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  REJECTED:   { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-400" },
  CLOSED:     { bg: "bg-slate-100",  text: "text-slate-600",   dot: "bg-slate-400" },
};

function FraudBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-300 text-xs">—</span>;
  const isHigh = score >= 70;
  const isMed = score >= 40;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
      isHigh ? "bg-red-50 text-red-700 border-red-200" :
      isMed  ? "bg-amber-50 text-amber-700 border-amber-200" :
               "bg-emerald-50 text-emerald-700 border-emerald-200"
    }`}>
      {isHigh && <AlertTriangle className="h-3 w-3" />}
      {score}%
    </div>
  );
}

export default function ClaimsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [fraudFilter, setFraudFilter] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search && { search }),
        ...(status && { status }),
        ...(type && { type }),
      });
      const res = await fetch(`/api/claims?${params}`);
      const data = (await res.json()) as { data: Claim[]; total: number; error?: string };
      if (!res.ok) { setFetchError(data.error ?? `Erreur ${res.status}`); return; }
      setClaims(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setFetchError("Impossible de charger les sinistres. Vérifiez votre connexion.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, type, fraudFilter]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  return (
    <MainLayout>
      <div className="space-y-5" style={{ fontFamily: "Inter, sans-serif" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Sinistres
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {total.toLocaleString("fr-FR")} sinistre{total !== 1 ? "s" : ""} · 142 actifs
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN") && (
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 bg-white/70 hover:bg-slate-50 transition-colors">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            )}
            <Link href="/claims/new">
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 shadow-md transition-all">
                <Plus className="h-4 w-4" />
                Nouveau sinistre
              </button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                placeholder="Rechercher par numéro, assuré, type..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-44 rounded-xl"
              placeholder="Statut"
            />
            <Select
              options={TYPE_OPTIONS}
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
              className="w-44 rounded-xl"
              placeholder="Type"
            />
            <Select
              options={FRAUD_OPTIONS}
              value={fraudFilter}
              onChange={(e) => { setFraudFilter(e.target.value); setPage(1); }}
              className="w-44 rounded-xl"
              placeholder="Score fraude"
            />
            {(search || status || type || fraudFilter) && (
              <button
                onClick={() => { setSearch(""); setStatus(""); setType(""); setFraudFilter(""); setPage(1); }}
                className="text-xs text-slate-400 hover:text-slate-600 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-16">
            <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-red-500 font-medium text-sm">{fetchError}</p>
            <button onClick={fetchClaims} className="mt-3 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50">
              Réessayer
            </button>
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Filter className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-600">Aucun sinistre trouvé</p>
            {(search || status || type) ? (
              <p className="text-sm text-slate-400 mt-1">Essayez de modifier les filtres</p>
            ) : (
              <p className="text-sm text-slate-400 mt-1">Aucun sinistre ne vous est attribué</p>
            )}
          </div>
        ) : (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
            {/* Table header */}
            <div
              className="grid gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
              style={{ gridTemplateColumns: "160px 1fr 150px 110px 90px 110px 100px 80px" }}
            >
              <span>N° Sinistre</span>
              <span>Assuré</span>
              <span>Type</span>
              <span>Statut</span>
              <span className="text-center">Fraude</span>
              <span>Montant</span>
              <span>Date</span>
              <span className="text-center">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {claims.map((claim) => {
                const badge = STATUS_BADGE[claim.status] ?? STATUS_BADGE.SUBMITTED;
                return (
                  <div
                    key={claim.id}
                    onClick={() => router.push(`/claims/${claim.id}`)}
                    className="grid gap-3 items-center px-5 py-4 hover:bg-indigo-50/30 cursor-pointer transition-colors"
                    style={{ gridTemplateColumns: "160px 1fr 150px 110px 90px 110px 100px 80px" }}
                  >
                    {/* Claim number */}
                    <span className="font-mono text-sm font-bold text-indigo-600">{claim.claimNumber}</span>

                    {/* Policyholder */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                        {claim.policyholder.firstName[0]}{claim.policyholder.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {claim.policyholder.firstName} {claim.policyholder.lastName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {claim.policyholder.vehicleMake} {claim.policyholder.vehicleModel}
                        </p>
                      </div>
                    </div>

                    {/* Type */}
                    <span className="text-xs text-slate-600 truncate">{CLAIM_TYPE_LABELS[claim.type]}</span>

                    {/* Status */}
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${badge.bg} ${badge.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                        {CLAIM_STATUS_LABELS[claim.status]}
                      </span>
                    </div>

                    {/* Fraud score */}
                    <div className="flex justify-center">
                      <FraudBadge score={claim.fraudScore} />
                    </div>

                    {/* Amount */}
                    <span className="text-sm text-slate-600 font-medium">
                      {claim.estimatedAmount ? formatCurrency(claim.estimatedAmount) : <span className="text-slate-300">—</span>}
                    </span>

                    {/* Date */}
                    <span className="text-xs text-slate-400">{formatDate(claim.incidentDate)}</span>

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/claims/${claim.id}`}>
                        <button className="h-7 w-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors" title="Voir">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                      <Link href={`/claims/${claim.id}`}>
                        <button className="h-7 w-7 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors" title="Modifier">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Page <span className="font-semibold text-slate-700">{page}</span> sur{" "}
              <span className="font-semibold text-slate-700">{totalPages}</span> ·{" "}
              {total.toLocaleString("fr-FR")} résultats
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-9 w-9 rounded-xl border border-slate-200 bg-white/70 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-9 w-9 rounded-xl text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-indigo-600 text-white shadow-md"
                        : "border border-slate-200 bg-white/70 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-9 w-9 rounded-xl border border-slate-200 bg-white/70 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
