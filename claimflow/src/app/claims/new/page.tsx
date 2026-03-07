"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { FileUpload, type FileWithStatus } from "@/components/ui/FileUpload";
import { CLAIM_TYPE_LABELS } from "@/types";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";

const STEPS = [
  { id: 1, title: "Assuré" },
  { id: 2, title: "Récapitulatif" },
  { id: 3, title: "Circonstances" },
  { id: 4, title: "Documents" },
];

const TYPE_OPTIONS = Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const StepThreeSchema = z.object({
  type: z.enum(["COLLISION", "THEFT", "VANDALISM", "GLASS", "FIRE", "NATURAL_DISASTER", "BODILY_INJURY", "OTHER"], {
    errorMap: () => ({ message: "Veuillez sélectionner le type de sinistre" }),
  }),
  description: z.string().min(10, "Description trop courte (min 10 caractères)"),
  incidentDate: z.string().min(1, "Date requise"),
  incidentLocation: z.string().min(5, "Lieu requis"),
  thirdPartyInvolved: z.boolean().default(false),
  thirdPartyName: z.string().optional(),
  thirdPartyPlate: z.string().optional(),
});

type StepThreeData = z.infer<typeof StepThreeSchema>;

interface Policyholder {
  id: string;
  firstName: string;
  lastName: string;
  policyNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehiclePlate: string;
  coverageType: string;
}

export default function NewClaimPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [policyholders, setPolicyholders] = useState<Policyholder[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPolicyholder, setSelectedPolicyholder] = useState<Policyholder | null>(null);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [created, setCreated] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { register, watch, control, formState: { errors }, trigger, getValues } = useForm<StepThreeData>({
    resolver: zodResolver(StepThreeSchema),
    defaultValues: { thirdPartyInvolved: false },
  });

  const thirdPartyInvolved = watch("thirdPartyInvolved");

  const searchPolicyholders = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setPolicyholders([]); return; }
    setSearchLoading(true);
    const res = await fetch(`/api/policyholders?search=${encodeURIComponent(query)}&pageSize=10`);
    const data = await res.json();
    setPolicyholders(data.data || []);
    setSearchLoading(false);
  };

  const nextStep = async () => {
    if (step === 1 && !selectedPolicyholder) { setFormError("Veuillez sélectionner un assuré."); return; }
    setFormError(null);
    if (step === 3) {
      const valid = await trigger(["type", "description", "incidentDate", "incidentLocation"]);
      if (!valid) {
        setFormError("Veuillez compléter tous les champs obligatoires avant de passer à l'étape suivante.");
        return;
      }
    }
    setStep(s => Math.min(4, s + 1));
  };

  const handleCreate = async () => {
    const valid = await trigger(["type", "description", "incidentDate", "incidentLocation"]);
    if (!valid) return;
    const data = getValues();
    if (!selectedPolicyholder) return;
    setSubmitting(true);
    setFormError(null);
    setUploadErrors([]);

    let claimId: string;

    // Step 1: Create the claim
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: data.type,
          description: data.description,
          incidentDate: new Date(data.incidentDate).toISOString(),
          incidentLocation: data.incidentLocation,
          thirdPartyInvolved: data.thirdPartyInvolved,
          policyholderID: selectedPolicyholder.id,
          ...(data.thirdPartyInvolved && {
            thirdPartyInfo: { name: data.thirdPartyName, plate: data.thirdPartyPlate },
          }),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur lors de la création du sinistre");
      claimId = json.data.id;
    } catch (err) {
      setFormError((err as Error).message);
      setSubmitting(false);
      return;
    }

    // Step 2: Upload valid files (skip entries already in error state)
    const validFiles = files.filter((f) => f.status === "selected");

    if (validFiles.length > 0) {
      // Mark all valid files as uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "selected" ? { ...f, status: "uploading" } : f
        )
      );

      const errors: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const entry = files[i];
        if (entry.status !== "selected") continue;

        const fd = new FormData();
        fd.append("file", entry.file);

        try {
          const res = await fetch(`/api/claims/${claimId}/documents`, {
            method: "POST",
            body: fd,
          });
          const json = await res.json();
          if (!res.ok) {
            const msg = json.error ?? "Erreur inconnue";
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i ? { ...f, status: "error", error: msg } : f
              )
            );
            errors.push(`${entry.file.name} : ${msg}`);
          } else {
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i
                  ? { ...f, status: "success", documentId: json.data?.id }
                  : f
              )
            );
          }
        } catch {
          const msg = "Échec de l'upload";
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: "error", error: msg } : f
            )
          );
          errors.push(`${entry.file.name} : ${msg}`);
        }
      }

      if (errors.length > 0) {
        setUploadErrors(errors);
      }
    }

    setSubmitting(false);
    setCreated(claimId);
  };

  if (created) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto text-center py-16">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sinistre créé !</h2>
          <p className="text-gray-500 mb-6">Le dossier a été soumis avec succès.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push(`/claims/${created}`)}>Voir le dossier</Button>
            <Button variant="outline" onClick={() => router.push("/claims")}>Retour à la liste</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Nouveau sinistre</h1>
          <p className="text-gray-500 text-sm mt-1">Étape {step} sur {STEPS.length}</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium flex-shrink-0 ${
                step > s.id ? "bg-green-500 text-white" : step === s.id ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
              }`}>{step > s.id ? "✓" : s.id}</div>
              <div className="ml-2">
                <div className={`text-sm font-medium ${step >= s.id ? "text-gray-900" : "text-gray-400"}`}>{s.title}</div>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-3 ${step > s.id ? "bg-green-300" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{formError}</div>
        )}

        <form onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
          {/* Step 1: Search policyholder */}
          {step === 1 && (
            <Card>
              <CardHeader><CardTitle>Rechercher l&apos;assuré</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom, email ou numéro de police</Label>
                  <Input
                    placeholder="Saisir pour rechercher..."
                    value={searchQuery}
                    onChange={e => searchPolicyholders(e.target.value)}
                  />
                  {searchLoading && <p className="text-xs text-gray-400">Recherche...</p>}
                </div>
                {policyholders.length > 0 && (
                  <div className="border rounded divide-y">
                    {policyholders.map(ph => (
                      <button key={ph.id} type="button" className="w-full text-left p-3 hover:bg-gray-50"
                        onClick={() => { setSelectedPolicyholder(ph); setPolicyholders([]); setFormError(null); }}>
                        <div className="font-medium">{ph.firstName} {ph.lastName}</div>
                        <div className="text-sm text-gray-500">{ph.policyNumber} · {ph.vehicleMake} {ph.vehicleModel} ({ph.vehiclePlate})</div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPolicyholder && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-700">Assuré sélectionné</span>
                    </div>
                    <div className="text-sm space-y-1 text-gray-700">
                      <p><span className="font-medium">Nom :</span> {selectedPolicyholder.firstName} {selectedPolicyholder.lastName}</p>
                      <p><span className="font-medium">Police :</span> {selectedPolicyholder.policyNumber}</p>
                      <p><span className="font-medium">Véhicule :</span> {selectedPolicyholder.vehicleMake} {selectedPolicyholder.vehicleModel} ({selectedPolicyholder.vehicleYear})</p>
                      <p><span className="font-medium">Immatriculation :</span> {selectedPolicyholder.vehiclePlate}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Summary */}
          {step === 2 && selectedPolicyholder && (
            <Card>
              <CardHeader><CardTitle>Récapitulatif assuré &amp; véhicule</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><div className="text-gray-500">Assuré</div><div className="font-medium">{selectedPolicyholder.firstName} {selectedPolicyholder.lastName}</div></div>
                  <div><div className="text-gray-500">Numéro de police</div><div className="font-mono font-medium">{selectedPolicyholder.policyNumber}</div></div>
                  <div><div className="text-gray-500">Véhicule</div><div className="font-medium">{selectedPolicyholder.vehicleMake} {selectedPolicyholder.vehicleModel} {selectedPolicyholder.vehicleYear}</div></div>
                  <div><div className="text-gray-500">Immatriculation</div><div className="font-mono font-medium">{selectedPolicyholder.vehiclePlate}</div></div>
                  <div><div className="text-gray-500">Couverture</div><div className="font-medium">{selectedPolicyholder.coverageType}</div></div>
                </div>
                <p className="text-sm text-gray-500 mt-4 p-3 bg-gray-50 rounded">Vérifiez les informations ci-dessus avant de continuer.</p>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Incident */}
          {step === 3 && (
            <Card>
              <CardHeader><CardTitle>Circonstances du sinistre</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Type de sinistre *</Label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select
                        options={TYPE_OPTIONS}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        placeholder="Sélectionner le type"
                        className={errors.type ? "border-red-500" : ""}
                      />
                    )}
                  />
                  {errors.type && <p className="text-red-500 text-xs">{errors.type.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date du sinistre *</Label>
                    <Input type="date" {...register("incidentDate")} max={new Date().toISOString().split("T")[0]} className={errors.incidentDate ? "border-red-500" : ""} />
                    {errors.incidentDate && <p className="text-red-500 text-xs">{errors.incidentDate.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Lieu *</Label>
                    <Input {...register("incidentLocation")} placeholder="Adresse ou description" className={errors.incidentLocation ? "border-red-500" : ""} />
                    {errors.incidentLocation && <p className="text-red-500 text-xs">{errors.incidentLocation.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description des circonstances *</Label>
                  <Textarea {...register("description")} placeholder="Décrivez en détail les circonstances, dommages, parties impliquées..." rows={5} className={errors.description ? "border-red-500" : ""} />
                  {errors.description && <p className="text-red-500 text-xs">{errors.description.message}</p>}
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register("thirdPartyInvolved")} className="h-4 w-4 rounded" />
                    <span className="text-sm font-medium">Tiers impliqué</span>
                  </label>
                  {thirdPartyInvolved && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Nom du tiers</Label>
                        <Input {...register("thirdPartyName")} placeholder="Nom Prénom" />
                      </div>
                      <div className="space-y-2">
                        <Label>Plaque du tiers</Label>
                        <Input {...register("thirdPartyPlate")} placeholder="AA-000-BB" />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Documents */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Documents &amp; photos (optionnel)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">
                  Ajoutez les pièces justificatives : constat, photos des dégâts, rapport de police…
                </p>
                <FileUpload
                  files={files}
                  onFilesChange={setFiles}
                  disabled={submitting}
                />
                {uploadErrors.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
                    <p className="text-sm font-medium text-red-700">Certains fichiers n&apos;ont pas pu être uploadés :</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {uploadErrors.map((err, i) => (
                        <li key={i} className="text-xs text-red-600">{err}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-red-500 mt-1">Le sinistre a bien été créé. Vous pourrez ajouter les documents depuis la fiche du dossier.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button type="button" variant="outline" disabled={step === 1} onClick={() => setStep(s => Math.max(1, s - 1))}>
              <ArrowLeft className="h-4 w-4 mr-2" />Précédent
            </Button>
            {step < STEPS.length ? (
              <Button type="button" onClick={nextStep}>Suivant<ArrowRight className="h-4 w-4 ml-2" /></Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={submitting}>
                {submitting ? <><Spinner size="sm" className="mr-2 border-white border-t-transparent" />Création...</> : <><CheckCircle className="h-4 w-4 mr-2" />Soumettre</>}
              </Button>
            )}
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
