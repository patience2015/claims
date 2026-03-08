"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { NotificationType } from "@/types";

interface Preference {
  type: NotificationType;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

const TYPE_LABELS: Record<NotificationType, { label: string; description: string }> = {
  CLAIM_ASSIGNED: {
    label: "Assignation de sinistre",
    description: "Quand un sinistre vous est assigné",
  },
  STATUS_CHANGED: {
    label: "Changement de statut",
    description: "Quand le statut d'un sinistre est modifié",
  },
  FRAUD_ALERT: {
    label: "Alerte fraude",
    description: "Quand un score de fraude élevé est détecté",
  },
  SLA_BREACH: {
    label: "SLA dépassé",
    description: "Quand un sinistre dépasse 30 jours sans décision",
  },
  DOCUMENT_UPLOADED_BY_POLICYHOLDER: {
    label: "Document reçu",
    description: "Quand un assuré dépose un document",
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
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        checked ? "bg-indigo-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
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
      // Merge with all types to ensure all types are present
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

  const handleToggle = (
    type: NotificationType,
    field: "emailEnabled" | "inAppEnabled",
    value: boolean
  ) => {
    setPrefs((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [field]: value } : p))
    );
    setSaved(false);
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
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  };

  if (sessionStatus === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  if (!session || session.user.role === "POLICYHOLDER") return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bell className="h-6 w-6 text-indigo-600" />
          Préférences de notifications
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Choisissez comment vous souhaitez être notifié pour chaque événement.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Préférences sauvegardées avec succès.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-indigo-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Type de notification</span>
            <span className="w-20 text-center">In-app</span>
            <span className="w-16 text-center">Email</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {prefs.map((pref) => {
              const config = TYPE_LABELS[pref.type];
              return (
                <div
                  key={pref.type}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-6 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{config.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
                  </div>
                  <div className="w-20 flex justify-center">
                    <Toggle
                      checked={pref.inAppEnabled}
                      onChange={(v) => handleToggle(pref.type, "inAppEnabled", v)}
                      label={`Notification in-app pour ${config.label}`}
                    />
                  </div>
                  <div className="w-16 flex justify-center">
                    <Toggle
                      checked={pref.emailEnabled}
                      onChange={(v) => handleToggle(pref.type, "emailEnabled", v)}
                      label={`Email pour ${config.label}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end mt-6">
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {saving ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Sauvegarder les préférences
        </Button>
      </div>
    </div>
  );
}
