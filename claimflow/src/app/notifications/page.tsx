"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Settings } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  FileText,
  RefreshCw,
  UserCheck,
  UserX,
  Shield,
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
  label: string;
};

const TYPE_CONFIG: Record<NotificationType, IconConfig> = {
  CLAIM_ASSIGNED: {
    Icon: UserCheck,
    iconClass: "text-blue-500",
    bgClass: "bg-blue-50",
    label: "Assignation",
  },
  STATUS_CHANGED: {
    Icon: RefreshCw,
    iconClass: "text-green-500",
    bgClass: "bg-green-50",
    label: "Changement de statut",
  },
  FRAUD_ALERT: {
    Icon: AlertTriangle,
    iconClass: "text-red-500",
    bgClass: "bg-red-50",
    label: "Alerte fraude",
  },
  SLA_BREACH: {
    Icon: Clock,
    iconClass: "text-orange-500",
    bgClass: "bg-orange-50",
    label: "SLA dépassé",
  },
  DOCUMENT_UPLOADED_BY_POLICYHOLDER: {
    Icon: FileText,
    iconClass: "text-purple-500",
    bgClass: "bg-purple-50",
    label: "Document reçu",
  },
  NETWORK_FRAUD_ALERT: {
    Icon: AlertTriangle,
    iconClass: "text-red-600",
    bgClass: "bg-red-50",
    label: "Réseau fraude",
  },
  NETWORK_ESCALATED: {
    Icon: AlertTriangle,
    iconClass: "text-red-700",
    bgClass: "bg-red-100",
    label: "Réseau escaladé",
  },
  USER_ACTIVATED: {
    Icon: UserCheck,
    iconClass: "text-emerald-500",
    bgClass: "bg-emerald-50",
    label: "Compte activé",
  },
  USER_DEACTIVATED: {
    Icon: UserX,
    iconClass: "text-red-500",
    bgClass: "bg-red-50",
    label: "Compte désactivé",
  },
  ROLE_CHANGED: {
    Icon: Shield,
    iconClass: "text-indigo-500",
    bgClass: "bg-indigo-50",
    label: "Rôle modifié",
  },
};

type StatusFilter = "ALL" | "UNREAD" | "READ";

const FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: "Toutes",
  UNREAD: "Non lues",
  READ: "Lues",
};

// --------------------------------------------------------------------------
// Page component
// --------------------------------------------------------------------------

export default function NotificationsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  // Redirect if not authenticated or POLICYHOLDER
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (session.user.role === "POLICYHOLDER") {
      router.push("/");
    }
  }, [session, sessionStatus, router]);

  const buildQuery = useCallback(
    (cursor?: string): string => {
      const params = new URLSearchParams({ limit: "20" });
      if (filter === "UNREAD") params.set("read", "false");
      else if (filter === "READ") params.set("read", "true");
      if (cursor) {
        params.set("cursor", cursor);
      }
      return params.toString();
    },
    [filter]
  );

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNextCursor(null);
    try {
      const res = await fetch(`/api/notifications?${buildQuery()}`);
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
      setUnreadCount(data.unreadCount ?? 0);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    if (session && session.user.role !== "POLICYHOLDER") {
      fetchNotifications();
    }
  }, [fetchNotifications, session]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/notifications?${buildQuery(nextCursor)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        data: NotificationItem[];
        unreadCount: number;
        nextCursor: string | null;
      };
      setNotifications((prev) => [...prev, ...(data.data ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      // silencieux
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkRead = async (notif: NotificationItem) => {
    if (notif.read) return;
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
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // silencieux
    }
  };

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
        setUnreadCount(0);
      }
    } catch {
      // silencieux
    } finally {
      setMarkingAll(false);
    }
  };

  if (sessionStatus === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" className="text-blue-500" />
      </div>
    );
  }

  if (!session || session.user.role === "POLICYHOLDER") {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-600" />
            Mes notifications
            <Link
              href="/notifications/preferences"
              className="ml-1 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Préférences de notifications"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {unreadCount} notification{unreadCount !== 1 ? "s" : ""} non lue
              {unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="shrink-0"
          >
            {markingAll ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <CheckCheck className="h-4 w-4 mr-2" />
            )}
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {(["ALL", "UNREAD", "READ"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex justify-center items-center py-16">
          <Spinner size="lg" className="text-blue-500" />
        </div>
      )}

      {!loading && error && (
        <div className="py-8 text-center text-sm text-red-500">{error}</div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="py-16 text-center">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aucune notification</p>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {notifications.map((notif) => {
            const config = TYPE_CONFIG[notif.type];
            const { Icon } = config;
            const isUnread = !notif.read;

            const cardContent = (
              <div
                className={`flex gap-4 px-4 py-4 transition-colors hover:bg-gray-50 ${
                  isUnread ? "bg-blue-50/30" : ""
                }`}
              >
                {/* Icône */}
                <div
                  className={`shrink-0 mt-0.5 h-10 w-10 rounded-full ${config.bgClass} flex items-center justify-center`}
                >
                  <Icon className={`h-5 w-5 ${config.iconClass}`} />
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm ${
                        isUnread
                          ? "font-semibold text-gray-900"
                          : "font-medium text-gray-700"
                      }`}
                    >
                      {notif.title}
                    </p>
                    {isUnread && (
                      <span className="shrink-0 h-2 w-2 mt-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{notif.body}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                    <span className="text-xs text-gray-300">•</span>
                    <span className="text-xs text-gray-400">{config.label}</span>
                  </div>
                </div>
              </div>
            );

            if (notif.claimId) {
              return (
                <Link
                  key={notif.id}
                  href={`/claims/${notif.claimId}`}
                  className="block"
                  onClick={() => handleMarkRead(notif)}
                >
                  {cardContent}
                </Link>
              );
            }

            return (
              <div
                key={notif.id}
                className="cursor-default"
                onClick={() => handleMarkRead(notif)}
              >
                {cardContent}
              </div>
            );
          })}
        </div>
      )}

      {/* Charger plus */}
      {nextCursor && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Chargement...
              </>
            ) : (
              "Charger plus"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
