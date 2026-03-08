"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  FileText,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { NotificationType } from "@/types";

// Shape returned by GET /api/notifications
interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  readAt: string | null;
  claimId: string | null;
  createdAt: string;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;

  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `il y a ${diffD} j`;

  const diffM = Math.floor(diffD / 30);
  return `il y a ${diffM} mois`;
}

type IconConfig = {
  Icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  bgClass: string;
};

const TYPE_CONFIG: Record<NotificationType, IconConfig> = {
  CLAIM_ASSIGNED: {
    Icon: UserCheck,
    iconClass: "text-blue-500",
    bgClass: "bg-blue-50",
  },
  STATUS_CHANGED: {
    Icon: RefreshCw,
    iconClass: "text-green-500",
    bgClass: "bg-green-50",
  },
  FRAUD_ALERT: {
    Icon: AlertTriangle,
    iconClass: "text-red-500",
    bgClass: "bg-red-50",
  },
  SLA_BREACH: {
    Icon: Clock,
    iconClass: "text-orange-500",
    bgClass: "bg-orange-50",
  },
  DOCUMENT_UPLOADED_BY_POLICYHOLDER: {
    Icon: FileText,
    iconClass: "text-purple-500",
    bgClass: "bg-purple-50",
  },
};

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange: (count: number) => void;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function NotificationDropdown({
  isOpen,
  onClose,
  onCountChange,
}: NotificationDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Chargement des notifications à l'ouverture
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) {
        setError("Impossible de charger les notifications.");
        return;
      }
      const data = (await res.json()) as {
        data: NotificationItem[];
        unreadCount: number;
        nextCursor: string | null;
      };
      setNotifications(data.data ?? []);
      onCountChange(data.unreadCount ?? 0);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Marquer une notification comme lue
  const handleMarkRead = async (notif: NotificationItem) => {
    if (notif.read) {
      if (notif.claimId) {
        onClose();
      }
      return;
    }

    try {
      const res = await fetch(`/api/notifications/${notif.id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id
              ? { ...n, read: true, readAt: new Date().toISOString() }
              : n
          )
        );
        const newUnread = notifications.filter(
          (n) => !n.read && n.id !== notif.id
        ).length;
        onCountChange(newUnread);
      }
    } catch {
      // silencieux
    }

    if (notif.claimId) {
      onClose();
    }
  };

  // Tout marquer comme lu
  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            read: true,
            readAt: n.readAt ?? new Date().toISOString(),
          }))
        );
        onCountChange(0);
      }
    } catch {
      // silencieux
    } finally {
      setMarkingAll(false);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-96 max-h-[520px] bg-white rounded-lg shadow-lg border border-gray-200 z-50 flex flex-col"
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 hover:text-gray-800 h-7 px-2"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <Spinner size="sm" className="mr-1" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
              )}
              Tout marquer comme lu
            </Button>
          )}
          <Link
            href="/notifications"
            onClick={onClose}
            className="text-xs text-blue-600 hover:underline"
          >
            Voir tout
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
        {loading && (
          <div className="flex justify-center items-center py-10">
            <Spinner size="md" className="text-blue-500" />
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-center text-sm text-red-500">
            {error}
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            Aucune notification
          </div>
        )}

        {!loading &&
          !error &&
          notifications.map((notif) => {
            const config = TYPE_CONFIG[notif.type];
            const { Icon } = config;
            const isUnread = !notif.read;
            // Contenu partagé de la notification
            const innerContent = (
              <>
                {/* Icône */}
                <div
                  className={`mt-0.5 shrink-0 h-8 w-8 rounded-full ${config.bgClass} flex items-center justify-center`}
                >
                  <Icon className={`h-4 w-4 ${config.iconClass}`} />
                </div>

                {/* Texte */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-snug ${
                      isUnread
                        ? "font-semibold text-gray-900"
                        : "font-medium text-gray-700"
                    }`}
                  >
                    {notif.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {notif.body}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-gray-400">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Point non lu */}
                {isUnread && (
                  <div className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-blue-500" />
                )}
              </>
            );

            // Wrapper Link si claimId
            if (notif.claimId) {
              return (
                <Link
                  key={notif.id}
                  href={`/claims/${notif.claimId}`}
                  className={`flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
                    isUnread ? "bg-blue-50/40" : ""
                  }`}
                  onClick={() => handleMarkRead(notif)}
                >
                  {innerContent}
                </Link>
              );
            }

            return (
              <button
                key={notif.id}
                onClick={() => handleMarkRead(notif)}
                className={`w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-gray-50 ${
                  isUnread ? "bg-blue-50/40" : ""
                }`}
              >
                {innerContent}
              </button>
            );
          })}
      </div>
    </div>
  );
}

