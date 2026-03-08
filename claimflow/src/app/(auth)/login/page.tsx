"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Mail, Lock, Eye, EyeOff, Zap } from "lucide-react";

const LoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginFormData = z.infer<typeof LoginSchema>;

const DEMO_ACCOUNTS = [
  { label: "Gestionnaire", email: "julie@claimflow.ai", password: "password123", color: "indigo" },
  { label: "Manager",      email: "marc@claimflow.ai",  password: "password123", color: "cyan" },
  { label: "Admin",        email: "thomas@claimflow.ai", password: "password123", color: "purple" },
] as const;

const HERO_STATS = [
  { value: "12 847", label: "Sinistres traités" },
  { value: "98.2%", label: "Précision IA" },
  { value: "4.2j", label: "Délai moyen" },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    if (result?.error) {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  const fillDemo = (email: string, password: string) => {
    setValue("email", email);
    setValue("password", password);
    setError(null);
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "Inter, sans-serif", background: "#f8fafc" }}>

      {/* Hero — left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 bg-white -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 bg-white translate-y-1/3 -translate-x-1/3" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              ClaimFlow AI
            </span>
          </div>
          <p className="text-indigo-200 text-sm">Insurtech Engine</p>
        </div>

        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Gestion des sinistres
              <br />
              <span className="text-cyan-200">augmentée par IA</span>
            </h1>
            <p className="text-indigo-200 mt-3 text-sm leading-relaxed max-w-sm">
              Détection de fraude, estimation automatique et suivi en temps réel pour vos équipes sinistres.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {HERO_STATS.map(({ value, label }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                  {value}
                </div>
                <div className="text-xs text-indigo-200 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-indigo-300">
          © 2026 ClaimFlow AI · Sécurité · Support
        </div>
      </div>

      {/* Form — right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              ClaimFlow AI
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Connexion
            </h2>
            <p className="text-sm text-slate-400 mt-1">Connectez-vous avec vos identifiants professionnels</p>
          </div>

          {/* Glass card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Email professionnel
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    placeholder="prenom.nom@claimflow.fr"
                    {...register("email")}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors ${
                      errors.email ? "border-red-300" : "border-slate-200"
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Mot de passe
                  </label>
                  <button type="button" className="text-xs text-indigo-600 hover:text-indigo-800">
                    Oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...register("password")}
                    className={`w-full pl-11 pr-12 py-3 rounded-xl border text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors ${
                      errors.password ? "border-red-300" : "border-slate-200"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    rememberMe ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                  }`}
                  onClick={() => setRememberMe((v) => !v)}
                >
                  {rememberMe && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-slate-600">Se souvenir de moi</span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 shadow-md hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Spinner size="sm" className="border-white border-t-transparent" /> Connexion en cours...</>
                ) : (
                  "Se connecter"
                )}
              </button>
            </form>
          </div>

          {/* Demo credentials */}
          <div className="mt-5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/60 p-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Accès rapide — Démo
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(({ label, email, password, color }) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => fillDemo(email, password)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-100 bg-white/80 hover:bg-indigo-50 hover:border-indigo-200 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                      color === "indigo" ? "bg-indigo-100 text-indigo-700" :
                      color === "cyan" ? "bg-cyan-100 text-cyan-700" :
                      "bg-purple-100 text-purple-700"
                    }`}>
                      {label[0]}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-700">{label}</span>
                      <span className="text-[11px] text-slate-400 ml-2">{email}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-indigo-600 opacity-0 group-hover:opacity-100 font-medium transition-opacity">
                    Utiliser →
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            © 2026 ClaimFlow AI · Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
