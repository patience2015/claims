import { FraudNetworkStatus } from "@/types";

const CONFIG: Record<FraudNetworkStatus, { label: string; className: string }> = {
  CRITICAL: { label: "Critique", className: "bg-red-100 text-red-800 border-red-200" },
  SUSPECT: { label: "Suspect", className: "bg-orange-100 text-orange-800 border-orange-200" },
  UNDER_INVESTIGATION: { label: "En investigation", className: "bg-blue-100 text-blue-800 border-blue-200" },
  DISMISSED: { label: "Faux positif", className: "bg-gray-100 text-gray-600 border-gray-200" },
  ACTIVE: { label: "Actif", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  INACTIVE: { label: "Inactif", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

export function FraudNetworkBadge({ status }: { status: FraudNetworkStatus }) {
  const config = CONFIG[status] ?? CONFIG.ACTIVE;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
