"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Save, Mail, Smartphone, Shield, AlertTriangle, FileText, Clock, UserCheck } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { NotificationType } from "@/types";

interface Preference {
  type: NotificationType;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

const CATEGORIES = [
  {
    key: "sinistres",
    label: "Sinistres",
    icon: FileText,
    color: "indigo",
    types: ["CLAIM_ASSIGNED", "STATUS_CHANGED", "DOCUMENT_UPLOADED_BY_POLICYHOLDER"] as NotificationType[],
  },
  {
    key: "fraude",
    label: "Fraude & Sécurité",
    icon: Shield,
    color: "red",
    types: ["FRAUD_ALERT"] as NotificationType[],
  },
  {
    key: "sla",
    label: "SLA & Performance",
    icon: Clock,
    color: "amber",
    types: ["SLA_BREACH"] as NotificationType[],
  },
];

const TYPE_META: Record<NotificationType, { label: string; description: string; icon: typeof Bell }> = {
  CLAIM_ASSIGNED: {
    label: "Assignation de sinistre",
    description: "Quand un sinistre vous est assigné",
    icon: UserCheck,
  },
  STATUS_CHANGED: {
    label: "Changement de statut",
    description: "Quand le statut d'un sinistre est modifié",
    icon: FileText,
  },
  FRAUD_ALERT: {
    label: "Alerte fraude",
    description: "Quand un score de fraude élevé est détecté",
    icon: AlertTriangle,
  },
  SLA_BREACH: {
    label: "SLA dépassé",
    description: "Quand un sinistre dépasse 30 jours sans décision",
    icon: Clock,
  },
  DOCUMENT_UPLOADED_BY_POLICYHOLDER: {
    label: "Document reçu",
    description: "Quand un assuré dépose un document",
    icon: FileText,
  },
  NETWORK_FRAUD_ALERT: {
    label: "Réseau fraude",
    description: "Quand un cluster frauduleux est détecté",
    icon: AlertTriangle,
  },
  NETWORK_ESCALATED: {
    label: "Réseau escaladé",
    description: "Quand un réseau suspect est escaladé en investigation",
    icon: AlertTriangle,
  },
};

const NOTIFICATION_TYPES: NotificationType[] = [
  "CLAIM_ASSIGNED",
  "STATUS_CHANGED",
  "FRAUD_ALERT",
  "SLA_BREACH",
  "DOCUMENT_UPLOADED_BY_POLICYHOLDER",
];

function Toggle({
  checked,
  onChange,
  label,
  color = "indigo",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  color?: "indigo" | "cyan";
}) {
  const bg = checked
    ? color === "indigo"
      ? "bg-indigo-600"
      : "bg-cyan-500"
    : "bg-slate-200";
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          color === "indigo" ? "focus:ring-indigo-500" : "focus:ring-cyan-500"
        } ${bg}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className={`text-[10px] font-medium ${checked ? (color === "indigo" ? "text-indigo-600" : "text-cyan-600") : "text-slate-400"}`}>
        {checked ? "Activé" : "Désactivé"}
      </span>
    </div>
  );
}

export default function NotificationPreferencesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session) { router.push("/login"); return; }
    if (session.user.role === "POLICYHOLDER") { router.push("/"); return; }
  }, [session, sessionStatus, router]);

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) { setError("Impossible de charger les préférences."); return; }
      const data = (await res.json()) as { data: Preference[] };
      const existing = data.data ?? [];
      const merged = NOTIFICATION_TYPES.map((type) => {
        const found = existing.find((p) => p.type === type);
        return found ?? { type, emailEnabled: true, inAppEnabled: true };
      });
      setPrefs(merged);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session && session.user.role !== "POLICYHOLDER") {
      fetchPrefs();
    }
  }, [fetchPrefs, session]);

  const handleToggle = (type: NotificationType, field: "emailEnabled" | "inAppEnabled", value: boolean) => {
    setPrefs((prev) => prev.map((p) => (p.type === type ? { ...p, [field]: value } : p)));
    setSaved(false);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) { setError("Impossible de sauvegarder."); return; }
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  };

  const activeInApp = prefs.filter((p) => p.inAppEnabled).length;
  const activeEmail = prefs.filter((p) => p.emailEnabled).length;
  const total = prefs.length;

  if (sessionStatus === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <Spinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  if (!session || session.user.role === "POLICYHOLDER") return null;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Radial bg glow */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(79,70,229,0.08) 0%, transparent 70%)"
      }} />

      <div className="relative max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-md">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium tracking-wider uppercase">Paramètres</div>
              <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                Préférences de notifications
              </h1>
            </div>
            {hasChanges && (
              <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Modifications non sauvegardées
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 ml-13 pl-13" style={{ paddingLeft: "52px" }}>
            Choisissez comment vous souhaitez être notifié pour chaque événement.
          </p>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "In-app actives", value: activeInApp, total, color: "indigo", icon: Smartphone },
            { label: "Email actifs", value: activeEmail, total, color: "cyan", icon: Mail },
            { label: "Types configurés", value: total, total, color: "slate", icon: Bell },
          ].map(({ label, value, color, icon: Icon }) => (
            <div
              key={label}
              className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4 flex items-center gap-3"
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                color === "indigo" ? "bg-indigo-50 text-indigo-600" :
                color === "cyan" ? "bg-cyan-50 text-cyan-600" :
                "bg-slate-100 text-slate-500"
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className={`text-2xl font-bold ${
                  color === "indigo" ? "text-indigo-600" :
                  color === "cyan" ? "text-cyan-600" :
                  "text-slate-700"
                }`}>{value}</div>
                <div className="text-xs text-slate-400">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
            <Save className="h-4 w-4 shrink-0" />
            Préférences sauvegardées avec succès.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const categoryPrefs = prefs.filter((p) => category.types.includes(p.type));
              const allInApp = categoryPrefs.every((p) => p.inAppEnabled);
              const allEmail = categoryPrefs.every((p) => p.emailEnabled);

              return (
                <div
                  key={category.key}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden"
                >
                  {/* Category header */}
                  <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 ${
                    category.color === "indigo" ? "bg-indigo-50/60" :
                    category.color === "red" ? "bg-red-50/60" :
                    "bg-amber-50/60"
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                        category.color === "indigo" ? "bg-indigo-100 text-indigo-600" :
                        category.color === "red" ? "bg-red-100 text-red-600" :
                        "bg-amber-100 text-amber-600"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-slate-800 text-sm">{category.label}</span>
                    </div>
                    {/* Bulk toggles */}
                    <div className="flex items-center gap-6 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span>Tous In-app</span>
                        <button
                          type="button"
                          onClick={() => {
                            category.types.forEach((type) => handleToggle(type, "inAppEnabled", !allInApp));
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${allInApp ? "bg-indigo-600" : "bg-slate-200"}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${allInApp ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Tous Email</span>
                        <button
                          type="button"
                          onClick={() => {
                            category.types.forEach((type) => handleToggle(type, "emailEnabled", !allEmail));
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${allEmail ? "bg-cyan-500" : "bg-slate-200"}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${allEmail ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_120px_100px] gap-4 px-6 py-2 bg-slate-50/50 border-b border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Type</span>
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-500 uppercase tracking-wider">
                      <Smartphone className="h-3 w-3" /> In-app
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-cyan-500 uppercase tracking-wider">
                      <Mail className="h-3 w-3" /> Email
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-slate-50">
                    {category.types.map((type) => {
                      const pref = prefs.find((p) => p.type === type);
                      if (!pref) return null;
                      const meta = TYPE_META[type];
                      const RowIcon = meta.icon;
                      return (
                        <div key={type} className="grid grid-cols-[1fr_120px_100px] gap-4 items-center px-6 py-4 hover:bg-slate-50/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <RowIcon className="h-4 w-4 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{meta.label}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
                            </div>
                          </div>
                          <div className="flex justify-center">
                            <Toggle
                              checked={pref.inAppEnabled}
                              onChange={(v) => handleToggle(type, "inAppEnabled", v)}
                              label={`Notification in-app pour ${meta.label}`}
                              color="indigo"
                            />
                          </div>
                          <div className="flex justify-center">
                            <Toggle
                              checked={pref.emailEnabled}
                              onChange={(v) => handleToggle(type, "emailEnabled", v)}
                              label={`Email pour ${meta.label}`}
                              color="cyan"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Save bar */}
        <div className="sticky bottom-6 mt-8">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {hasChanges ? "Vous avez des modifications non sauvegardées." : "Toutes les préférences sont à jour."}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { fetchPrefs(); setHasChanges(false); }}
                disabled={saving || loading}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Spinner size="sm" className="border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
