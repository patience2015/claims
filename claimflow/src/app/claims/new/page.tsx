"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MainLayout } from "@/components/layout/main-layout";
import { Spinner } from "@/components/ui/spinner";
import { FileUpload, type FileWithStatus } from "@/components/ui/FileUpload";
import { CLAIM_TYPE_LABELS } from "@/types";
import {
  ArrowLeft, ArrowRight, CheckCircle, User, AlertTriangle,
  FileText, Search, MapPin, Calendar, X, Sparkles
} from "lucide-react";
import { useAddressAutocomplete, type AddressResult } from "@/hooks/use-address-autocomplete";

const STEPS = [
  { id: 1, title: "Type", icon: AlertTriangle },
  { id: 2, title: "Détails", icon: FileText },
  { id: 3, title: "Assuré", icon: User },
  { id: 4, title: "Documents", icon: FileText },
];

const CLAIM_TYPE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  COLLISION: { icon: "🚗", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  THEFT: { icon: "🔓", color: "text-red-600", bg: "bg-red-50 border-red-200" },
  VANDALISM: { icon: "⚠️", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  GLASS: { icon: "🪟", color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200" },
  FIRE: { icon: "🔥", color: "text-red-600", bg: "bg-red-50 border-red-200" },
  NATURAL_DISASTER: { icon: "⛈️", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
  BODILY_INJURY: { icon: "🏥", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  OTHER: { icon: "📋", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
};

const TYPE_OPTIONS = Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const StepThreeSchema = z.object({
  type: z.enum(["COLLISION", "THEFT", "VANDALISM", "GLASS", "FIRE", "NATURAL_DISASTER", "BODILY_INJURY", "OTHER"], {
    errorMap: () => ({ message: "Veuillez sélectionner le type de sinistre" }),
  }),
  description: z.string().min(10, "Description trop courte (min 10 caractères)"),
  incidentDate: z.string().min(1, "Date requise"),
  incidentLocation: z.string().min(5, "Lieu requis"),
  incidentCity: z.string().optional(),
  incidentZipCode: z.string().optional(),
  incidentCountry: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function FieldWrap({
  label, error, children, required,
}: { label: string; error?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

const inputCls = (error?: string) =>
  `w-full px-4 py-2.5 rounded-xl border text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors ${error ? "border-red-300 focus:ring-red-400" : "border-slate-200"
  }`;

export default function NewClaimPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [policyholders, setPolicyholders] = useState<Policyholder[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPolicyholder, setSelectedPolicyholder] = useState<Policyholder | null>(null);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [created, setCreated] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    setValue,
    trigger,
    getValues,
    watch,
    formState: { errors },
  } = useForm<StepThreeData>({
    resolver: zodResolver(StepThreeSchema),
    defaultValues: { thirdPartyInvolved: false },
  });

  const { suggestions, loading: addressLoading, searchAddress, setSuggestions } = useAddressAutocomplete();

  const handleSelectAddress = (addr: AddressResult) => {
    setValue("incidentLocation", addr.formattedAddress);
    setValue("incidentCity", addr.city);
    setValue("incidentZipCode", addr.zipCode);
    setValue("incidentCountry", addr.country);
    setValue("latitude", addr.lat);
    setValue("longitude", addr.lng);
    setSuggestions([]);
  };

  const thirdPartyInvolved = watch("thirdPartyInvolved");

  const searchPolicyholders = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setPolicyholders([]); return; }
    setSearchLoading(true);
    const res = await fetch(`/api/policyholders?search=${encodeURIComponent(query)}&pageSize=10`);
    const data = (await res.json()) as { data: Policyholder[] };
    setPolicyholders(data.data || []);
    setSearchLoading(false);
  };

  const nextStep = async () => {
    if (step === 1 && !selectedType) { setFormError("Veuillez sélectionner un type de sinistre."); return; }
    if (step === 2) {
      const valid = await trigger(["description", "incidentDate", "incidentLocation"]);
      if (!valid) { setFormError("Veuillez compléter tous les champs obligatoires."); return; }
    }
    if (step === 3 && !selectedPolicyholder) { setFormError("Veuillez sélectionner un assuré."); return; }
    setFormError(null);
    setStep((s) => Math.min(4, s + 1));
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
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: data.type,
          description: data.description,
          incidentDate: new Date(data.incidentDate).toISOString(),
          incidentLocation: data.incidentLocation,
          incidentCity: data.incidentCity,
          incidentZipCode: data.incidentZipCode,
          incidentCountry: data.incidentCountry,
          latitude: data.latitude,
          longitude: data.longitude,
          thirdPartyInvolved: data.thirdPartyInvolved,
          policyholderID: selectedPolicyholder.id,
          ...(data.thirdPartyInvolved && {
            thirdPartyInfo: { name: data.thirdPartyName, plate: data.thirdPartyPlate },
          }),
        }),
      });
      const json = (await res.json()) as { error?: string; data?: { id: string } };
      if (!res.ok) throw new Error(json.error ?? "Erreur lors de la création du sinistre");
      claimId = json.data!.id;
    } catch (err) {
      setFormError((err as Error).message);
      setSubmitting(false);
      return;
    }

    const validFiles = files.filter((f) => f.status === "selected");
    if (validFiles.length > 0) {
      setFiles((prev) => prev.map((f) => f.status === "selected" ? { ...f, status: "uploading" } : f));
      const errs: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const entry = files[i];
        if (entry.status !== "selected") continue;
        const fd = new FormData();
        fd.append("file", entry.file);
        try {
          const res = await fetch(`/api/claims/${claimId}/documents`, { method: "POST", body: fd });
          const json = (await res.json()) as { error?: string; data?: { id: string } };
          if (!res.ok) {
            const msg = json.error ?? "Erreur inconnue";
            setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: msg } : f));
            errs.push(`${entry.file.name} : ${msg}`);
          } else {
            setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "success", documentId: json.data?.id } : f));
          }
        } catch {
          const msg = "Échec de l'upload";
          setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: msg } : f));
          errs.push(`${entry.file.name} : ${msg}`);
        }
      }
      if (errs.length > 0) setUploadErrors(errs);
    }

    setSubmitting(false);
    setCreated(claimId);
  };

  if (created) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
            Sinistre créé !
          </h2>
          <p className="text-slate-500 mb-8">Le dossier a été soumis avec succès et est en attente de traitement.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/claims/${created}`)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-md hover:shadow-lg transition-all"
            >
              Voir le dossier
            </button>
            <button
              onClick={() => router.push("/claims")}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Retour à la liste
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
            Déclarer un sinistre
          </h1>
          <p className="text-sm text-slate-400 mt-1">Étape {step} sur {STEPS.length}</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-8 relative">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`relative h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${done
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                    : active
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-4 ring-indigo-100"
                      : "bg-white border-2 border-slate-200 text-slate-400"
                    }`}>
                    {done ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-[11px] font-medium ${active ? "text-indigo-600" : done ? "text-emerald-600" : "text-slate-400"}`}>
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-colors ${done ? "bg-emerald-400" : "bg-slate-100"}`} />
                )}
              </div>
            );
          })}
        </div>

        {formError && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        <form onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>

          {/* STEP 1 — Type de sinistre */}
          {step === 1 && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                    Type de sinistre
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Sélectionnez la catégorie correspondant à votre déclaration</p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Lancer l&apos;IA
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {TYPE_OPTIONS.map(({ value, label }) => {
                  const meta = CLAIM_TYPE_ICONS[value] ?? { icon: "📋", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" };
                  const isSelected = selectedType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setSelectedType(value);
                        setValue("type", value as StepThreeData["type"]);
                        setFormError(null);
                      }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${isSelected
                        ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100"
                        : `border ${meta.bg} hover:border-indigo-300 hover:shadow-sm`
                        }`}
                    >
                      <span className="text-2xl">{meta.icon}</span>
                      <span className={`text-sm font-semibold ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>{label}</span>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-indigo-600 ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {/* STEP 2 — Détails */}
          {step === 2 && (
            <GlassCard className="p-6">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                  Circonstances du sinistre
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Renseignez les détails de l&apos;incident</p>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <FieldWrap label="Date du sinistre" error={errors.incidentDate?.message} required>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        {...register("incidentDate")}
                        max={new Date().toISOString().split("T")[0]}
                        className={`${inputCls(errors.incidentDate?.message)} pl-10`}
                      />
                    </div>
                  </FieldWrap>
                  <FieldWrap label="Lieu" error={errors.incidentLocation?.message} required>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                      <input
                        {...register("incidentLocation")}
                        autoComplete="off"
                        onChange={(e) => {
                          register("incidentLocation").onChange(e);
                          searchAddress(e.target.value);
                        }}
                        placeholder="Saisissez l'adresse de l'incident..."
                        className={`${inputCls(errors.incidentLocation?.message)} pl-10`}
                      />
                      {addressLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Spinner size="sm" className="text-indigo-400" />
                        </div>
                      )}

                      {suggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          {suggestions.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleSelectAddress(s)}
                              className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex items-start gap-3 border-b border-slate-50 last:border-0"
                            >
                              <MapPin className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-slate-800">{s.formattedAddress}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{s.city ? `${s.city}, ` : ""}{s.country}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </FieldWrap>
                </div>
                <FieldWrap label="Description des circonstances" error={errors.description?.message} required>
                  <textarea
                    {...register("description")}
                    placeholder="Décrivez en détail les circonstances, dommages, parties impliquées..."
                    rows={5}
                    className={`${inputCls(errors.description?.message)} resize-none`}
                  />
                </FieldWrap>
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" {...register("thirdPartyInvolved")} className="sr-only peer" />
                      <div className="h-5 w-5 rounded-md border-2 border-amber-300 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100" />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-amber-800">Tiers impliqué</span>
                  </label>
                  {thirdPartyInvolved && (
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-amber-100">
                      <FieldWrap label="Nom du tiers">
                        <input {...register("thirdPartyName")} placeholder="Nom Prénom" className={inputCls()} />
                      </FieldWrap>
                      <FieldWrap label="Plaque du tiers">
                        <input {...register("thirdPartyPlate")} placeholder="AA-000-BB" className={inputCls()} />
                      </FieldWrap>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          )}

          {/* STEP 3 — Assuré */}
          {step === 3 && (
            <GlassCard className="p-6">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                  Rechercher l&apos;assuré
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Nom, email ou numéro de police</p>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  placeholder="Saisir pour rechercher..."
                  value={searchQuery}
                  onChange={(e) => searchPolicyholders(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors"
                />
                {searchLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Spinner size="sm" className="text-indigo-400" />
                  </div>
                )}
              </div>

              {policyholders.length > 0 && (
                <div className="rounded-xl border border-slate-100 overflow-hidden mb-4 shadow-sm">
                  {policyholders.map((ph, i) => (
                    <button
                      key={ph.id}
                      type="button"
                      className={`w-full text-left px-4 py-3.5 hover:bg-indigo-50 transition-colors flex items-center gap-3 ${i > 0 ? "border-t border-slate-50" : ""}`}
                      onClick={() => { setSelectedPolicyholder(ph); setPolicyholders([]); setFormError(null); setSearchQuery(""); }}
                    >
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {ph.firstName[0]}{ph.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{ph.firstName} {ph.lastName}</p>
                        <p className="text-xs text-slate-400">{ph.policyNumber} · {ph.vehicleMake} {ph.vehicleModel} ({ph.vehiclePlate})</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedPolicyholder ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">Assuré sélectionné</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPolicyholder(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                    >
                      <X className="h-3.5 w-3.5" /> Changer
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: "Assuré", value: `${selectedPolicyholder.firstName} ${selectedPolicyholder.lastName}` },
                      { label: "Police", value: selectedPolicyholder.policyNumber, mono: true },
                      { label: "Véhicule", value: `${selectedPolicyholder.vehicleMake} ${selectedPolicyholder.vehicleModel} (${selectedPolicyholder.vehicleYear})` },
                      { label: "Immatriculation", value: selectedPolicyholder.vehiclePlate, mono: true },
                      { label: "Couverture", value: selectedPolicyholder.coverageType },
                    ].map(({ label, value, mono }) => (
                      <div key={label} className="bg-white/60 rounded-lg p-2.5">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
                        <p className={`text-slate-800 font-medium mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !searchQuery && (
                  <div className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                    <User className="h-8 w-8 mb-2" />
                    <p className="text-sm">Tapez pour rechercher un assuré</p>
                  </div>
                )
              )}
            </GlassCard>
          )}

          {/* STEP 4 — Documents */}
          {step === 4 && (
            <GlassCard className="p-6">
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-violet-600" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-800" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                    Documents &amp; photos
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-medium">Optionnel</span>
                </div>
                <p className="text-xs text-slate-400">Constat, photos des dégâts, rapport de police…</p>
              </div>

              {/* Summary recap */}
              <div className="rounded-xl bg-slate-50/60 border border-slate-100 p-4 mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Récapitulatif</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-400">Type :</span> <span className="font-medium text-slate-700">{CLAIM_TYPE_LABELS[selectedType as keyof typeof CLAIM_TYPE_LABELS] ?? "—"}</span></div>
                  <div><span className="text-slate-400">Assuré :</span> <span className="font-medium text-slate-700">{selectedPolicyholder ? `${selectedPolicyholder.firstName} ${selectedPolicyholder.lastName}` : "—"}</span></div>
                  <div><span className="text-slate-400">Date :</span> <span className="font-medium text-slate-700">{getValues("incidentDate") || "—"}</span></div>
                  <div><span className="text-slate-400">Lieu :</span> <span className="font-medium text-slate-700">{getValues("incidentLocation") || "—"}</span></div>
                </div>
              </div>

              <FileUpload files={files} onFilesChange={setFiles} disabled={submitting} />

              {uploadErrors.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl space-y-1">
                  <p className="text-sm font-semibold text-red-700">Certains fichiers n&apos;ont pas pu être uploadés :</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {uploadErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600">{err}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-500 mt-1">
                    Le sinistre a bien été créé. Vous pourrez ajouter les documents depuis la fiche du dossier.
                  </p>
                </div>
              )}
            </GlassCard>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Précédent
            </button>
            {step < STEPS.length ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 shadow-md transition-all"
              >
                Suivant <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 shadow-md transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <><Spinner size="sm" className="border-white border-t-transparent" /> Création...</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Soumettre</>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
