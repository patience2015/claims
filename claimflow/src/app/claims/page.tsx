"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import {
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  ClaimStatus,
  ClaimType,
} from "@/types";
import { formatDate, formatCurrency, getStatusColor, getFraudColor } from "@/lib/utils";
import { Plus, Search, Filter, AlertTriangle } from "lucide-react";
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

export default function ClaimsPage() {
  const { data: session } = useSession();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const pageSize = 20;

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
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      setClaims(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setFetchError("Impossible de charger les sinistres. Vérifiez votre connexion.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, type]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sinistres</h1>
            <p className="text-gray-500 text-sm mt-1">
              {total} sinistre{total !== 1 ? "s" : ""} trouvé{total !== 1 ? "s" : ""}
            </p>
          </div>
          <Link href="/claims/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau sinistre
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select
                options={STATUS_OPTIONS}
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-44"
                placeholder="Statut"
              />
              <Select
                options={TYPE_OPTIONS}
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }}
                className="w-44"
                placeholder="Type"
              />
            </div>
          </CardContent>
        </Card>

        {/* Claims table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-12">
            <p className="text-red-500 font-medium">{fetchError}</p>
            <Button variant="outline" className="mt-4" onClick={fetchClaims}>Réessayer</Button>
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Filter className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun sinistre trouvé</p>
            {(search || status || type) ? (
              <p className="text-sm mt-1">Essayez de modifier les filtres</p>
            ) : (
              <div className="mt-2 space-y-1">
                <p className="text-sm">Aucun sinistre ne vous est attribué.</p>
                <p className="text-xs text-gray-400">
                  Si la liste était visible avant, déconnectez-vous puis reconnectez-vous.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Sinistre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assuré</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date sinistre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score fraude</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant estimé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gestionnaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {claims.map((claim) => (
                  <tr
                    key={claim.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => window.location.href = `/claims/${claim.id}`}
                  >
                    <td className="px-4 py-3 text-sm font-mono font-medium text-blue-600">
                      {claim.claimNumber}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusColor(claim.status)}>
                        {CLAIM_STATUS_LABELS[claim.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {CLAIM_TYPE_LABELS[claim.type]}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {claim.policyholder.firstName} {claim.policyholder.lastName}
                      <div className="text-xs text-gray-400">
                        {claim.policyholder.vehicleMake} {claim.policyholder.vehicleModel}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(claim.incidentDate)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {claim.fraudScore !== null ? (
                        <div className="flex items-center gap-1">
                          {claim.fraudScore > 70 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                          <span className={`font-semibold ${getFraudColor(claim.fraudScore)}`}>
                            {claim.fraudScore}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {claim.estimatedAmount ? formatCurrency(claim.estimatedAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {claim.assignedTo?.name || <span className="text-gray-300">Non assigné</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} sur {Math.ceil(total / pageSize)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage(p => p + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
