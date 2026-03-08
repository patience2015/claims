"use client";
import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";

interface NotificationBadgeProps {
  onClick?: () => void;
  /**
   * Quand fourni par le parent (Navbar), ce compteur remplace le polling interne.
   * Le polling est quand même déclenché pour initialiser la valeur.
   */
  externalCount?: number;
}

export function NotificationBadge({ onClick, externalCount }: NotificationBadgeProps) {
  const { data: session } = useSession();
  const [internalCount, setInternalCount] = useState(0);

  useEffect(() => {
    if (!session || session.user.role === "POLICYHOLDER") return;

    const fetchCount = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count");
        if (res.ok) {
          const data = (await res.json()) as { unreadCount: number };
          setInternalCount(data.unreadCount ?? 0);
        }
      } catch {
        // silencieux
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session || session.user.role === "POLICYHOLDER") return null;

  // Le parent peut passer un externalCount pour refléter les mises à jour
  // du dropdown (marquage comme lu). On prend le max entre les deux pour
  // éviter les flashs vers le bas lors d'une réconciliation.
  const count = externalCount !== undefined ? externalCount : internalCount;
  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-md hover:bg-gray-100 transition-colors"
      aria-label={`${count} notification${count !== 1 ? "s" : ""} non lue${count !== 1 ? "s" : ""}`}
    >
      <Bell className="h-5 w-5 text-gray-600" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {displayCount}
        </span>
      )}
    </button>
  );
}
