"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Shield, LogOut, User, Network, Map, Scale,
  BarChart2, ChevronDown,
} from "lucide-react";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

// Items always visible in main nav
const MAIN_NAV_ITEMS = [
  { href: "/claims", label: "Sinistres", icon: FileText, roles: ["HANDLER", "MANAGER", "ADMIN"] },
];

// Items grouped under "Analyses" dropdown
const ANALYSES_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/fraud-networks", label: "Réseaux suspects", icon: Network },
  { href: "/analytics/risk-heatmap", label: "Carte de risque", icon: Map },
  { href: "/compliance", label: "Conformité", icon: Scale },
];

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Administration", icon: Shield, roles: ["ADMIN"] },
];

const ROLE_LABELS: Record<string, string> = {
  HANDLER: "Gestionnaire",
  MANAGER: "Manager",
  ADMIN: "Administrateur",
};

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user?.role;
  const [notifOpen, setNotifOpen] = useState(false);
  const [syncedUnreadCount, setSyncedUnreadCount] = useState<number | undefined>(undefined);
  const [analysesOpen, setAnalysesOpen] = useState(false);
  const analysesRef = useRef<HTMLDivElement>(null);

  const showNotifications = !!session?.user && role !== "POLICYHOLDER";
  const showAnalyses = role === "MANAGER" || role === "ADMIN";
  const isAnalysesActive = ANALYSES_ITEMS.some((item) => pathname.startsWith(item.href));

  // Close analyses dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (analysesRef.current && !analysesRef.current.contains(e.target as Node)) {
        setAnalysesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo + Nav links */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">CF</span>
              </div>
              <span className="text-lg font-bold text-gray-900">ClaimFlow AI</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {/* Sinistres — always visible */}
              {MAIN_NAV_ITEMS.filter((item) => role && item.roles.includes(role)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname.startsWith(item.href)
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}

              {/* Analyses dropdown — MANAGER + ADMIN */}
              {showAnalyses && (
                <div ref={analysesRef} className="relative">
                  <button
                    onClick={() => setAnalysesOpen((prev) => !prev)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isAnalysesActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <BarChart2 className="h-4 w-4" />
                    Analyses
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", analysesOpen && "rotate-180")} />
                  </button>

                  {analysesOpen && (
                    <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl border border-gray-100 shadow-lg z-50 py-1">
                      {ANALYSES_ITEMS.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setAnalysesOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                            pathname.startsWith(item.href)
                              ? "bg-indigo-50 text-indigo-700 font-medium"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Administration — ADMIN only */}
              {ADMIN_NAV_ITEMS.filter((item) => role && item.roles.includes(role)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname.startsWith(item.href)
                      ? "bg-purple-50 text-purple-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  <span className="ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-600">ADMIN</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            {showNotifications && (
              <div className="relative">
                <NotificationBadge
                  onClick={() => setNotifOpen((prev) => !prev)}
                  externalCount={syncedUnreadCount}
                />
                <NotificationDropdown
                  isOpen={notifOpen}
                  onClose={() => setNotifOpen(false)}
                  onCountChange={setSyncedUnreadCount}
                />
              </div>
            )}

            {/* User info + logout */}
            {session?.user && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{session.user.name}</span>
                  <Badge variant="secondary">{ROLE_LABELS[role || ""] || role}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Déconnexion</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
