"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AIAnalysisPanel } from "@/components/claims/AIAnalysisPanel";
import { ClaimTimeline } from "@/components/claims/ClaimTimeline";
import {
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  VALID_TRANSITIONS,
  ClaimStatus,
  ClaimWithRelations,
} from "@/types";
import { formatDate, formatDateTime, formatCurrency, getStatusColor } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { FileUpload, type FileWithStatus } from "@/components/ui/FileUpload";
import { ArrowLeft, MapPin, Calendar, Car, User, FileText, MessageSquare, UploadCloud, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";

const TYPE_OPTIONS = Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [claim, setClaim] = useState<ClaimWithRelations | null>(null);
  const [auditLogs, setAuditLogs] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [docFiles, setDocFiles] = useState<FileWithStatus[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [uploadDocErrors, setUploadDocErrors] = useState<string[]>([]);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({ type: "", description: "", incidentDate: "", incidentLocation: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Assign state
  const [handlers, setHandlers] = useState<{ id: string; name: string; email: string; active: boolean }[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchClaim = async () => {
    try {
      const canViewLogs = ["MANAGER", "ADMIN"].includes(session?.user?.role ?? "");
      const requests: Promise<Response>[] = [fetch(`/api/claims/${id}`)];
      if (canViewLogs) requests.push(fetch(`/api/admin/audit-logs?claimId=${id}`));

      const [claimRes, logsRes] = await Promise.all(requests);

      if (!claimRes.ok) throw new Error(`Sinistre introuvable (${claimRes.status})`);
      const claimData = await claimRes.json();
      setClaim(claimData.data);

      if (logsRes) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData.data || []);
      }
    } catch (err) {
      console.error("Erreur chargement sinistre:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (session !== undefined) fetchClaim(); }, [id, session]);

  useEffect(() => {
    if (session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN") {
      fetch("/api/admin/users?role=HANDLER&active=true&pageSize=100")
        .then(r => r.json())
        .then(d => setHandlers(d.data ?? []));
    }
  }, [session]);

  const updateStatus = async (newStatus: string) => {
    setStatusUpdating(true);
    await fetch(`/api/claims/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchClaim();
    setStatusUpdating(false);
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    await fetch(`/api/claims/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment, isInternal: true }),
    });
    setNewComment("");
    await fetchClaim();
    setAddingComment(false);
  };

  const uploadDocuments = async () => {
    const toUpload = docFiles.filter((f) => f.status === "selected");
    if (toUpload.length === 0) return;
    setUploadingDocs(true);
    setUploadDocErrors([]);
    setDocFiles((prev) => prev.map((f) => f.status === "selected" ? { ...f, status: "uploading" } : f));

    const errors: string[] = [];
    for (let i = 0; i < docFiles.length; i++) {
      const entry = docFiles[i];
      if (entry.status !== "selected") continue;
      const fd = new FormData();
      fd.append("file", entry.file);
      try {
        const res = await fetch(`/api/claims/${id}/documents`, { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          const msg = json.error ?? "Erreur inconnue";
          setDocFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: msg } : f));
          errors.push(`${entry.file.name} : ${msg}`);
        } else {
          setDocFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "success", documentId: json.data?.id } : f));
        }
      } catch {
        const msg = "Échec de l'upload";
        setDocFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: msg } : f));
        errors.push(`${entry.file.name} : ${msg}`);
      }
    }

    setUploadDocErrors(errors);
    setUploadingDocs(false);
    if (errors.length === 0) {
      setDocFiles([]);
      await fetchClaim();
    }
  };

  const reassign = async (userId: string) => {
    if (!userId) return;
    setAssigning(true);
    await fetch(`/api/claims/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setAssigning(false);
    await fetchClaim();
  };

  const openEdit = () => {
    if (!claim) return;
    setEditData({
      type: claim.type,
      description: claim.description,
      incidentDate: claim.incidentDate.toString().split("T")[0],
      incidentLocation: claim.incidentLocation,
    });
    setEditError(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setEditLoading(true);
    setEditError(null);
    const res = await fetch(`/api/claims/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editData,
        incidentDate: new Date(editData.incidentDate).toISOString(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setEditError(json.error ?? "Erreur lors de la modification");
      setEditLoading(false);
      return;
    }
    setEditOpen(false);
    setEditLoading(false);
    await fetchClaim();
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    await fetch(`/api/claims/${id}`, { method: "DELETE" });
    router.push("/claims");
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-12">
          <Spinner size="lg" className="text-blue-600" />
        </div>
      </MainLayout>
    );
  }

  if (!claim) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-gray-500">
          <p>Sinistre introuvable</p>
          <Link href="/claims">
            <Button variant="outline" className="mt-4">Retour aux sinistres</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const availableTransitions = VALID_TRANSITIONS[claim.status] || [];
  const canChangeStatus = session?.user?.role !== "HANDLER" ||
    !["APPROVED", "REJECTED"].includes(claim.status);

  return (
    <MainLayout>
      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Modifier le sinistre</h2>
              <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Type de sinistre</Label>
                <select
                  value={editData.type}
                  onChange={(e) => setEditData(d => ({ ...d, type: e.target.value }))}
                  className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Date du sinistre</Label>
                  <Input type="date" value={editData.incidentDate} onChange={(e) => setEditData(d => ({ ...d, incidentDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Lieu</Label>
                  <Input value={editData.incidentLocation} onChange={(e) => setEditData(d => ({ ...d, incidentLocation: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={4} value={editData.description} onChange={(e) => setEditData(d => ({ ...d, description: e.target.value }))} />
              </div>
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
              <Button onClick={saveEdit} disabled={editLoading}>
                {editLoading ? <Spinner size="sm" /> : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link href="/claims">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold font-mono text-gray-900">{claim.claimNumber}</h1>
                <Badge variant={getStatusColor(claim.status)}>
                  {CLAIM_STATUS_LABELS[claim.status]}
                </Badge>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {CLAIM_TYPE_LABELS[claim.type]} · Créé le {formatDate(claim.createdAt)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Edit — HANDLER (own, SUBMITTED only) or MANAGER/ADMIN */}
            {claim && (
              (session?.user?.role !== "HANDLER" || claim.status === "SUBMITTED") && (
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="h-4 w-4 mr-1" />Modifier
                </Button>
              )
            )}

            {/* Delete — MANAGER + ADMIN */}
            {["MANAGER", "ADMIN"].includes(session?.user?.role ?? "") && (
              !deleteConfirm ? (
                <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />Supprimer
                </Button>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-1.5">
                  <span className="text-sm text-red-700">Confirmer ?</span>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7 px-2 text-xs" onClick={handleDelete} disabled={deleteLoading}>
                    {deleteLoading ? <Spinner size="sm" /> : "Oui, supprimer"}
                  </Button>
                  <button onClick={() => setDeleteConfirm(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            )}

            {/* Status change */}
            {availableTransitions.length > 0 && canChangeStatus && (
              <div className="flex items-center gap-2">
                <Select
                  options={availableTransitions.map(s => ({
                    value: s,
                    label: CLAIM_STATUS_LABELS[s as ClaimStatus],
                  }))}
                  onChange={(e) => e.target.value && updateStatus(e.target.value)}
                  placeholder="Changer le statut"
                  className="w-52"
                  disabled={statusUpdating}
                />
                {statusUpdating && <Spinner size="sm" className="text-blue-600" />}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Claim info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Détails du sinistre
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-gray-500">Date du sinistre</div>
                      <div className="font-medium">{formatDate(claim.incidentDate)}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-gray-500">Lieu</div>
                      <div className="font-medium">{claim.incidentLocation}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-gray-500">Gestionnaire</div>
                      {["MANAGER", "ADMIN"].includes(session?.user?.role ?? "") ? (
                        <div className="flex items-center gap-2 mt-1">
                          <select
                            value={claim.assignedTo?.id ?? ""}
                            onChange={(e) => reassign(e.target.value)}
                            disabled={assigning}
                            className="text-sm border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                          >
                            <option value="">— Non assigné —</option>
                            {handlers.map(h => (
                              <option key={h.id} value={h.id}>{h.name} ({h.email})</option>
                            ))}
                          </select>
                          {assigning && <Spinner size="sm" className="text-blue-600" />}
                        </div>
                      ) : (
                        <div className="font-medium">{claim.assignedTo?.name || "Non assigné"}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Car className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-gray-500">Tiers impliqué</div>
                      <div className="font-medium">{claim.thirdPartyInvolved ? "Oui" : "Non"}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Description</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{claim.description}</p>
                </div>
                {claim.estimatedAmount && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <div className="text-xs text-gray-500">Montant estimé</div>
                      <div className="font-semibold text-blue-700">{formatCurrency(claim.estimatedAmount)}</div>
                    </div>
                    {claim.approvedAmount && (
                      <div>
                        <div className="text-xs text-gray-500">Montant approuvé</div>
                        <div className="font-semibold text-green-700">{formatCurrency(claim.approvedAmount)}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Policyholder info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Assuré
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Nom</div>
                    <div className="font-medium">{claim.policyholder.firstName} {claim.policyholder.lastName}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Email</div>
                    <div className="font-medium">{claim.policyholder.email}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Téléphone</div>
                    <div className="font-medium">{claim.policyholder.phone}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Numéro de police</div>
                    <div className="font-mono font-medium">{claim.policyholder.policyNumber}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Véhicule</div>
                    <div className="font-medium">
                      {claim.policyholder.vehicleMake} {claim.policyholder.vehicleModel} ({claim.policyholder.vehicleYear})
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Immatriculation</div>
                    <div className="font-mono font-medium">{claim.policyholder.vehiclePlate}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Analysis */}
            <Card>
              <CardContent className="pt-6">
                <AIAnalysisPanel claimId={id} policyholderEmail={claim.policyholder.email} onAnalysisComplete={fetchClaim} />
              </CardContent>
            </Card>

            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Commentaires internes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {claim.comments && claim.comments.length > 0 ? (
                  <div className="space-y-3">
                    {claim.comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded p-3 text-sm">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span className="font-medium text-gray-600">{comment.author.name}</span>
                          <span>{formatDateTime(comment.createdAt)}</span>
                        </div>
                        <p className="text-gray-700">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Aucun commentaire</p>
                )}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Ajouter un commentaire interne..."
                    className="flex-1 text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === "Enter" && addComment()}
                  />
                  <Button
                    size="sm"
                    onClick={addComment}
                    disabled={!newComment.trim() || addingComment}
                  >
                    {addingComment ? <Spinner size="sm" /> : "Ajouter"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1 col */}
          <div className="space-y-6">
            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historique</CardTitle>
              </CardHeader>
              <CardContent>
                <ClaimTimeline events={auditLogs as Parameters<typeof ClaimTimeline>[0]["events"]} />
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents {claim.documents && claim.documents.length > 0 ? `(${claim.documents.length})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {claim.documents && claim.documents.length > 0 ? (
                  <div className="space-y-2">
                    {claim.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="flex-1 truncate">{doc.filename}</span>
                        <span className="text-xs text-gray-400">
                          {(doc.size / 1024).toFixed(0)} Ko
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Aucun document</p>
                )}

                {/* Upload zone */}
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-gray-500 mb-2">Ajouter des documents</p>
                  <FileUpload
                    files={docFiles}
                    onFilesChange={setDocFiles}
                    disabled={uploadingDocs}
                  />
                  {uploadDocErrors.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 space-y-0.5">
                      {uploadDocErrors.map((err, i) => <p key={i}>{err}</p>)}
                    </div>
                  )}
                  {docFiles.some((f) => f.status === "selected") && (
                    <button
                      type="button"
                      onClick={uploadDocuments}
                      disabled={uploadingDocs}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {uploadingDocs ? "Upload en cours…" : "Envoyer les documents"}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
