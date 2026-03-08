"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo + titre */}
          <Link href="/portail/mes-sinistres" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-blue-600 flex-shrink-0">
              <span className="text-white font-bold text-sm">CF</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold text-gray-900">ClaimFlow AI</span>
              <span className="text-xs text-blue-600 font-medium tracking-wide">Espace Assuré</span>
            </div>
          </Link>

          {/* Déconnexion */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-red-600 hover:bg-red-50"
            onClick={() => signOut({ callbackUrl: "/portail/login" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Se déconnecter
          </Button>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
