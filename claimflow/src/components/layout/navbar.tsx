"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, Shield, LogOut, User, Network, Map } from "lucide-react";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

const NAV_ITEMS = [
  { href: "/claims", label: "Sinistres", icon: FileText, roles: ["HANDLER", "MANAGER", "ADMIN"] },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["MANAGER", "ADMIN"] },
  { href: "/fraud-networks", label: "Réseaux suspects", icon: Network, roles: ["MANAGER", "ADMIN"] },
  { href: "/analytics/risk-heatmap", label: "Carte de risque", icon: Map, roles: ["MANAGER", "ADMIN"] },
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

  const visibleItems = NAV_ITEMS.filter(item =>
    role && item.roles.includes(role)
  );

  const showNotifications =
    !!session?.user && role !== "POLICYHOLDER";

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">CF</span>
              </div>
              <span className="text-lg font-bold text-gray-900">ClaimFlow AI</span>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-1">
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname.startsWith(item.href)
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
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
