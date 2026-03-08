"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CLAIM_STATUS_LABELS, CLAIM_TYPE_LABELS, ClaimStatus, ClaimType } from "@/types";
import { formatDate, formatCurrency, getStatusColor } from "@/lib/utils";
import {
  FileText,
  ChevronLeft,
  AlertCircle,
  Upload,
  CheckCircle,
  XCircle,
  Paperclip,
} from "lucide-react";

interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

interface ClaimDetail {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  type: ClaimType;
  description: string;
  incidentDate: string;
  incidentLocation: string;
  thirdPartyInvolved: boolean;
  estimatedAmount: number | null;
  approvedAmount: number | null;
  closureReason: string | null;
  createdAt: string;
  updatedAt: string;
  documents: DocumentItem[];
  canUpload: boolean;
  canDecide: boolean;
}

export default function SinistreDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const claimId = params.id;

  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Decision state
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/portail/login");
      return;
    }
    if (sessionStatus === "authenticated" && session?.user?.role !== "POLICYHOLDER") {
      router.push("/portail/login");
    }
  }, [sessionStatus, session, router]);

  const fetchClaim = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portail/claims/${claimId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Erreur ${res.status}`);
        return;
      }
      setClaim(json.data);
    } catch {
      setError("Impossible de charger ce sinistre. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus !== "authenticated" || session?.user?.role !== "POLICYHOLDER") return;
    fetchClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session, claimId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/portail/claims/${claimId}/documents`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "Erreur lors de l'envoi");
        return;
      }
      setUploadSuccess(true);
      // Refresh claim to show new document
      await fetchClaim();
    } catch {
      setUploadError("Impossible d'envoyer le fichier. Vérifiez votre connexion.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDecision = async (decision: "ACCEPT" | "REJECT") => {
    if (decision === "REJECT" && rejectReason.trim().length < 20) {
      setDecisionError("Le motif doit contenir au moins 20 caractères.");
      return;
    }
    setDeciding(true);
    setDecisionError(null);
    try {
      const body: Record<string, string> = { decision };
      if (decision === "REJECT") body.reason = rejectReason.trim();

      const res = await fetch(`/api/portail/claims/${claimId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setDecisionError(json.error ?? "Erreur lors de la décision");
        return;
      }
      // Refresh claim to show new status
      await fetchClaim();
      setShowRejectForm(false);
      setRejectReason("");
    } catch {
      setDecisionError("Impossible d'enregistrer votre décision. Vérifiez votre connexion.");
    } finally {
      setDeciding(false);
    }
  };

  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && loading)) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner size="lg" className="text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Retour */}
      <Link
        href="/portail/mes-sinistres"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Mes sinistres
      </Link>

      {/* Erreur chargement */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Impossible de charger ce sinistre</p>
            <p className="text-red-600 mt-0.5">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-red-300 text-red-600 hover:bg-red-100"
              onClick={fetchClaim}
            >
              Réessayer
            </Button>
          </div>
        </div>
      )}

      {claim && (
        <>
          {/* En-tête sinistre */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 font-mono">
                  {claim.claimNumber}
                </h1>
                <Badge variant={getStatusColor(claim.status)}>
                  {CLAIM_STATUS_LABELS[claim.status]}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                Déclaré le {formatDate(claim.createdAt)} · Dernière mise à jour le{" "}
                {formatDate(claim.updatedAt)}
              </p>
            </div>
          </div>

          {/* Informations du sinistre */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détails du sinistre</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Type</p>
                <p className="font-medium text-gray-800">{CLAIM_TYPE_LABELS[claim.type]}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
                  Date du sinistre
                </p>
                <p className="font-medium text-gray-800">{formatDate(claim.incidentDate)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Lieu</p>
                <p className="font-medium text-gray-800">{claim.incidentLocation}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
                  Circonstances
                </p>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {claim.description}
                </p>
              </div>
              {claim.thirdPartyInvolved && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
                    Tiers impliqué
                  </p>
                  <p className="font-medium text-gray-800">Oui</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Montants */}
          {(claim.estimatedAmount !== null || claim.approvedAmount !== null) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Indemnisation</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {claim.estimatedAmount !== null && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
                      Montant estimé
                    </p>
                    <p className="text-xl font-bold text-gray-800">
                      {formatCurrency(claim.estimatedAmount)}
                    </p>
                  </div>
                )}
                {claim.approvedAmount !== null && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
                      Montant approuvé
                    </p>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(claim.approvedAmount)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Motif de clôture */}
          {claim.closureReason && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <p className="font-medium text-gray-700 mb-1">Motif de clôture</p>
              <p className="text-gray-600">{claim.closureReason}</p>
            </div>
          )}

          {/* Proposition d'indemnisation — décision assuré */}
          {claim.canDecide && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-base text-blue-900">
                  Proposition d&apos;indemnisation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-blue-800">
                  Une proposition d&apos;indemnisation de{" "}
                  <span className="font-bold">
                    {formatCurrency(claim.approvedAmount!)}
                  </span>{" "}
                  vous est soumise. Vous pouvez l&apos;accepter ou la refuser.
                </p>

                {decisionError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {decisionError}
                  </div>
                )}

                {!showRejectForm ? (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleDecision("ACCEPT")}
                      disabled={deciding}
                    >
                      {deciding ? (
                        <Spinner size="sm" className="mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Accepter la proposition
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => setShowRejectForm(true)}
                      disabled={deciding}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Refuser
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Motif de refus{" "}
                        <span className="text-gray-400 font-normal">(20 caractères min)</span>
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                        placeholder="Expliquez pourquoi vous refusez cette proposition…"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <p className="text-xs text-gray-400 mt-0.5">
                        {rejectReason.length}/20 caractères minimum
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => handleDecision("REJECT")}
                        disabled={deciding || rejectReason.trim().length < 20}
                      >
                        {deciding ? (
                          <Spinner size="sm" className="mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Confirmer le refus
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectReason("");
                          setDecisionError(null);
                        }}
                        disabled={deciding}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {claim.documents.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Aucun document joint à ce sinistre.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {claim.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 py-2.5">
                      <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(doc.size / 1024).toFixed(0)} Ko · {formatDate(doc.createdAt)}
                        </p>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex-shrink-0"
                      >
                        Voir
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {/* Upload */}
              {claim.canUpload && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Ajouter un document
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    Formats acceptés : PDF, JPG, PNG · Taille max : 5 Mo
                  </p>

                  {uploadError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-3">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      {uploadError}
                    </div>
                  )}

                  {uploadSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm mb-3">
                      <CheckCircle className="h-4 w-4" />
                      Document envoyé avec succès.
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadSuccess(false);
                          handleUpload(file);
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Spinner size="sm" className="mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {uploading ? "Envoi en cours…" : "Choisir un fichier"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informations de contact */}
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-500">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                Pour toute question concernant votre dossier, contactez votre gestionnaire par
                email ou téléphone. Référencez toujours votre numéro de sinistre{" "}
                <span className="font-mono font-semibold text-gray-700">
                  {claim.claimNumber}
                </span>
                .
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
