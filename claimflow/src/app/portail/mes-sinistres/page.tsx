"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CLAIM_STATUS_LABELS, CLAIM_TYPE_LABELS, ClaimStatus, ClaimType } from "@/types";
import { formatDate, formatCurrency, getStatusColor } from "@/lib/utils";
import { FileText, ChevronRight, AlertCircle } from "lucide-react";

interface PortailClaim {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  type: ClaimType;
  incidentDate: string;
  incidentLocation: string;
  estimatedAmount: number | null;
  approvedAmount: number | null;
  createdAt: string;
}

export default function MesSinistresPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [claims, setClaims] = useState<PortailClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirection si pas POLICYHOLDER
  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/portail/login");
      return;
    }
    if (sessionStatus === "authenticated" && session?.user?.role !== "POLICYHOLDER") {
      router.push("/portail/login");
    }
  }, [sessionStatus, session, router]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || session?.user?.role !== "POLICYHOLDER") return;

    const fetchClaims = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/portail/claims");
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? `Erreur ${res.status}`);
          return;
        }
        setClaims(json.data ?? []);
      } catch {
        setError("Impossible de charger vos sinistres. Vérifiez votre connexion.");
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, [sessionStatus, session]);

  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && loading)) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner size="lg" className="text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mes sinistres</h1>
        <p className="text-gray-500 text-sm mt-1">
          Consultez l&apos;état de vos déclarations de sinistre
        </p>
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Impossible de charger vos sinistres</p>
            <p className="text-red-600 mt-0.5">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-red-300 text-red-600 hover:bg-red-100"
              onClick={() => window.location.reload()}
            >
              Réessayer
            </Button>
          </div>
        </div>
      )}

      {/* Liste vide */}
      {!error && !loading && claims.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium">Aucun sinistre déclaré</p>
            <p className="text-sm text-gray-400 mt-1">
              Vous n&apos;avez pas encore de sinistre enregistré dans notre système.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Liste des sinistres */}
      {!error && claims.length > 0 && (
        <div className="space-y-3">
          {claims.map((claim) => (
            <Link
              key={claim.id}
              href={`/portail/mes-sinistres/${claim.id}`}
              className="block group"
            >
              <Card className="transition-shadow hover:shadow-md group-hover:border-blue-300">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Numéro + badge statut */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-mono font-semibold text-blue-700 text-base">
                          {claim.claimNumber}
                        </span>
                        <Badge variant={getStatusColor(claim.status)}>
                          {CLAIM_STATUS_LABELS[claim.status]}
                        </Badge>
                      </div>

                      {/* Type + date sinistre */}
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium text-gray-700">Type :</span>{" "}
                          {CLAIM_TYPE_LABELS[claim.type]}
                        </p>
                        <p>
                          <span className="font-medium text-gray-700">Date du sinistre :</span>{" "}
                          {formatDate(claim.incidentDate)}
                        </p>
                      </div>

                      {/* Montants si disponibles */}
                      {(claim.estimatedAmount !== null || claim.approvedAmount !== null) && (
                        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100 text-sm">
                          {claim.estimatedAmount !== null && (
                            <div>
                              <span className="text-gray-500">Montant estimé :</span>{" "}
                              <span className="font-semibold text-gray-800">
                                {formatCurrency(claim.estimatedAmount)}
                              </span>
                            </div>
                          )}
                          {claim.approvedAmount !== null && (
                            <div>
                              <span className="text-gray-500">Montant approuvé :</span>{" "}
                              <span className="font-semibold text-green-700">
                                {formatCurrency(claim.approvedAmount)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Flèche */}
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1 group-hover:text-blue-500 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
