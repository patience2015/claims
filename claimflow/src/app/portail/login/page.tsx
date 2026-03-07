"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, ShieldCheck } from "lucide-react";

export default function PortailLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/portail/mes-sinistres";

  const [policyNumber, setPolicyNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!policyNumber.trim()) {
      setError("Veuillez saisir votre numéro de police.");
      return;
    }
    if (!email.trim()) {
      setError("Veuillez saisir votre adresse email.");
      return;
    }

    setLoading(true);
    const result = await signIn("policyholder", {
      policyNumber: policyNumber.trim(),
      email: email.trim(),
      redirect: false,
    });

    if (result?.error) {
      setError("Numéro de police ou email incorrect. Veuillez vérifier vos informations.");
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-600 mb-4">
            <span className="text-white font-bold text-2xl">CF</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ClaimFlow AI</h1>
          <p className="text-gray-500 mt-1 text-sm">Espace Assuré</p>
        </div>

        {/* Encadré de bienvenue */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Bienvenue sur votre espace personnel</p>
            <p className="text-blue-700 leading-relaxed">
              Consultez l&apos;avancement de vos sinistres, déposez vos documents justificatifs
              et répondez aux propositions d&apos;indemnisation, directement en ligne, à tout moment.
            </p>
          </div>
        </div>

        {/* Formulaire */}
        <Card>
          <CardHeader>
            <CardTitle>Accéder à mon espace</CardTitle>
            <CardDescription>
              Identifiez-vous avec votre numéro de police et votre email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="policyNumber">Numéro de police</Label>
                <Input
                  id="policyNumber"
                  type="text"
                  placeholder="POL-2024-00123"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                  className={error ? "border-red-400" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="prenom.nom@email.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  className={error ? "border-red-400" : ""}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner size="sm" className="mr-2 border-white border-t-transparent" />
                    Connexion en cours…
                  </>
                ) : (
                  "Accéder à mon espace"
                )}
              </Button>
            </form>

            <p className="mt-5 text-xs text-center text-gray-400">
              Votre numéro de police figure sur votre contrat d&apos;assurance.
              En cas de difficulté, contactez votre gestionnaire.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
