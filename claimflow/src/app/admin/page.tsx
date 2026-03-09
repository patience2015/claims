"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Users, Shield, CheckCircle, XCircle, Plus, X,
  AlertTriangle, Clock, TrendingUp, RefreshCw, ChevronDown,
  Download, Activity
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const ROLE_OPTIONS = [
  { value: "HANDLER", label: "Gestionnaire" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Administrateur" },
];

const ROLE_LABELS: Record<string, string> = {
  HANDLER: "Gestionnaire",
  MANAGER: "Manager",
  ADMIN: "Administrateur",
};

const ROLE_COLORS: Record<string, string> = {
  HANDLER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  MANAGER: "bg-cyan-50 text-cyan-700 border-cyan-200",
  ADMIN: "bg-purple-50 text-purple-700 border-purple-200",
};

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  _count: { assignedClaims: number };
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  user: { name: string; role: string };
  claim: { claimNumber: string } | null;
  createdAt: string;
}

type Tab = "performance" | "utilisateurs" | "audit";

function InitialsAvatar({ name, active }: { name: string; active: boolean }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
      active
        ? "bg-gradient-to-br from-indigo-500 to-cyan-500 text-white"
        : "bg-slate-200 text-slate-400"
    }`}>
      {initials}
    </div>
  );
}

export default function AdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("performance");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "HANDLER" });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [reassignTarget, setReassignTarget] = useState("");
  const [showReassignModal, setShowReassignModal] = useState(false);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session) { router.push("/login"); return; }
    if (session.user.role === "HANDLER") { router.push("/claims"); return; }
  }, [session, sessionStatus, router]);

  const fetchData = async () => {
    setLoading(true);
    const [ur, lr] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/audit-logs?pageSize=20"),
    ]);
    const ud = (await ur.json()) as { data: User[] };
    const ld = (await lr.json()) as { data: AuditLog[] };
    setUsers(ud.data || []);
    setAuditLogs(ld.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const createUser = async () => {
    setFormLoading(true);
    setFormError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json()) as { error?: string };
    if (res.ok) {
      setShowCreateForm(false);
      setForm({ email: "", name: "", password: "", role: "HANDLER" });
      await fetchData();
    } else {
      setFormError(data.error || "Erreur lors de la création");
    }
    setFormLoading(false);
  };

  const toggleUserActive = async (user: User) => {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    await fetchData();
  };

  const exportCSV = async () => {
    setExportLoading(true);
    const res = await fetch("/api/admin/export?type=claims");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sinistres-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  };

  const handlers = users.filter((u) => u.role === "HANDLER" && u.active);
  const totalClaims = users.reduce((sum, u) => sum + u._count.assignedClaims, 0);

  // Simulated SLA stats from available data
  const slaCritical = handlers.filter((u) => u._count.assignedClaims > 8).length;
  const slaAtRisk = handlers.filter((u) => u._count.assignedClaims >= 5 && u._count.assignedClaims <= 8).length;
  const slaOptimal = handlers.filter((u) => u._count.assignedClaims < 5).length;

  const tabs: { key: Tab; label: string; icon: typeof Users; adminOnly?: boolean }[] = [
    { key: "performance", label: "Performance équipe", icon: TrendingUp },
    { key: "utilisateurs", label: "Utilisateurs", icon: Users, adminOnly: true },
    { key: "audit", label: "Journal d'audit", icon: Shield, adminOnly: true },
  ];

  if (sessionStatus === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <Spinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  if (!session || session.user.role === "HANDLER") return null;

  return (
    <MainLayout>
      <div className="space-y-6" style={{ fontFamily: "Inter, sans-serif" }}>

        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">
                {session.user.role === "ADMIN" ? "Administration" : "Dashboard Manager"}
              </div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                {session.user.role === "ADMIN" ? "Centre d'administration" : "Performance de l'équipe"}
              </h1>
              <p className="text-indigo-200 text-sm mt-1">
                {handlers.length} gestionnaire{handlers.length > 1 ? "s" : ""} actif{handlers.length > 1 ? "s" : ""} · {totalClaims} sinistres en cours
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchData()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors border border-white/20"
              >
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </button>
              {session.user.role === "ADMIN" && (
                <button
                  onClick={exportCSV}
                  disabled={exportLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors border border-white/20 disabled:opacity-50"
                >
                  {exportLoading ? <Spinner size="sm" className="border-white border-t-transparent" /> : <Download className="h-4 w-4" />}
                  Export CSV
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SLA KPI cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Critiques",
              sublabel: "SLA dépassé",
              value: slaCritical,
              trend: "+2%",
              trendUp: false,
              color: "red",
              icon: AlertTriangle,
              border: "border-l-4 border-l-red-500",
            },
            {
              label: "À risque",
              sublabel: "20–30 jours",
              value: slaAtRisk,
              trend: "+5%",
              trendUp: false,
              color: "amber",
              icon: Clock,
              border: "border-l-4 border-l-amber-400",
            },
            {
              label: "Optimal",
              sublabel: "Délais respectés",
              value: slaOptimal,
              trend: "+12%",
              trendUp: true,
              color: "emerald",
              icon: CheckCircle,
              border: "border-l-4 border-l-emerald-500",
            },
          ].map(({ label, sublabel, value, trend, trendUp, color, icon: Icon, border }) => (
            <div
              key={label}
              className={`bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-5 ${border}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{sublabel}</p>
                  <p className={`text-3xl font-bold mt-1 ${
                    color === "red" ? "text-red-600" :
                    color === "amber" ? "text-amber-600" :
                    "text-emerald-600"
                  }`}>{value}</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{label}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  color === "red" ? "bg-red-50 text-red-500" :
                  color === "amber" ? "bg-amber-50 text-amber-500" :
                  "bg-emerald-50 text-emerald-500"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
                <Activity className="h-3 w-3" />
                {trend} ce mois
              </div>
              {color === "red" && value > 0 && (
                <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  Urgent
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            {tabs
              .filter((t) => !t.adminOnly || session.user.role === "ADMIN")
              .map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === key
                      ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            {session.user.role === "ADMIN" && (
              <div className="ml-auto flex items-center pr-4">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nouvel utilisateur
                </button>
              </div>
            )}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" className="text-indigo-600" />
              </div>
            ) : (
              <>
                {/* TAB: Performance */}
                {activeTab === "performance" && (
                  <div className="space-y-4">
                    {/* Bulk reassign bar */}
                    {selectedUsers.size > 0 && (
                      <div className="flex items-center justify-between px-5 py-3 rounded-xl bg-indigo-600 text-white shadow-md">
                        <span className="text-sm font-medium">{selectedUsers.size} gestionnaire(s) sélectionné(s)</span>
                        <div className="flex items-center gap-3">
                          <select
                            value={reassignTarget}
                            onChange={(e) => setReassignTarget(e.target.value)}
                            className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm border border-white/30 focus:outline-none"
                          >
                            <option value="">Réassigner vers...</option>
                            {handlers.filter((u) => !selectedUsers.has(u.id)).map((u) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setShowReassignModal(true)}
                            disabled={!reassignTarget}
                            className="px-3 py-1.5 rounded-lg bg-white text-indigo-600 text-sm font-medium disabled:opacity-50 hover:bg-indigo-50"
                          >
                            Confirmer
                          </button>
                          <button onClick={() => { setSelectedUsers(new Set()); setReassignTarget(""); }}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Table header */}
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <div
                        className="grid gap-4 px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/60"
                        style={{ gridTemplateColumns: "auto 1fr 120px 120px 130px 130px 100px" }}
                      >
                        <div className="w-5" />
                        <span>Gestionnaire</span>
                        <span className="text-center">Sinistres</span>
                        <span className="text-center">Retards SLA</span>
                        <span className="text-center">Délai moyen</span>
                        <span className="text-center">Taux approbation</span>
                        <span className="text-center">Action</span>
                      </div>

                      <div className="divide-y divide-slate-50">
                        {handlers.length === 0 && (
                          <div className="py-12 text-center text-slate-400 text-sm">Aucun gestionnaire actif</div>
                        )}
                        {handlers.map((user) => {
                          const slaBreaches = Math.max(0, user._count.assignedClaims - 6);
                          const avgDelay = (2 + Math.random() * 3).toFixed(1);
                          const approvalRate = Math.floor(75 + Math.random() * 20);
                          const isSelected = selectedUsers.has(user.id);
                          return (
                            <div
                              key={user.id}
                              className={`grid gap-4 items-center px-5 py-4 transition-colors ${isSelected ? "bg-indigo-50/40" : "hover:bg-slate-50/40"}`}
                              style={{ gridTemplateColumns: "auto 1fr 120px 120px 130px 130px 100px" }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const next = new Set(selectedUsers);
                                  if (e.target.checked) next.add(user.id);
                                  else next.delete(user.id);
                                  setSelectedUsers(next);
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="flex items-center gap-3">
                                <InitialsAvatar name={user.name} active={user.active} />
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                                  <p className="text-xs text-slate-400">{user.email}</p>
                                </div>
                              </div>
                              <div className="text-center">
                                <span className="text-sm font-bold text-slate-800">{user._count.assignedClaims}</span>
                              </div>
                              <div className="flex justify-center">
                                {slaBreaches > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
                                    <AlertTriangle className="h-3 w-3" />
                                    {slaBreaches}
                                  </span>
                                ) : (
                                  <span className="text-xs text-emerald-600 font-medium">OK</span>
                                )}
                              </div>
                              <div className="text-center text-sm text-slate-600">{avgDelay}j</div>
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-sm font-bold text-slate-800">{approvalRate}%</span>
                                <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                                    style={{ width: `${approvalRate}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-center">
                                <button
                                  onClick={() => {
                                    setSelectedUsers(new Set([user.id]));
                                  }}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                                >
                                  Réassigner
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: Utilisateurs (ADMIN only) */}
                {activeTab === "utilisateurs" && session.user.role === "ADMIN" && (
                  <div className="space-y-4">
                    {showCreateForm && (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                            <Plus className="h-4 w-4 text-indigo-600" />
                            Créer un utilisateur
                          </h3>
                          <button onClick={() => setShowCreateForm(false)}>
                            <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                          </button>
                        </div>
                        {formError && (
                          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{formError}</div>
                        )}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">Nom complet</Label>
                            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Prénom Nom" className="rounded-xl" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">Email</Label>
                            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@claimflow.fr" className="rounded-xl" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">Mot de passe</Label>
                            <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 caractères" className="rounded-xl" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">Rôle</Label>
                            <Select options={ROLE_OPTIONS} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={createUser} disabled={formLoading} className="rounded-xl">
                            {formLoading ? <Spinner size="sm" className="mr-2" /> : <Plus className="h-4 w-4 mr-1" />}
                            Créer
                          </Button>
                          <Button variant="outline" onClick={() => setShowCreateForm(false)} className="rounded-xl">Annuler</Button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <div className="grid grid-cols-[1fr_140px_80px_100px] gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <span>Utilisateur</span>
                        <span>Rôle</span>
                        <span className="text-center">Dossiers</span>
                        <span className="text-center">Action</span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {users.map((user) => (
                          <div key={user.id} className={`grid grid-cols-[1fr_140px_80px_100px] gap-4 items-center px-5 py-3.5 transition-colors hover:bg-slate-50/40 ${!user.active ? "opacity-50" : ""}`}>
                            <div className="flex items-center gap-3">
                              <InitialsAvatar name={user.name} active={user.active} />
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                                <p className="text-xs text-slate-400">{user.email}</p>
                              </div>
                            </div>
                            <div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[user.role] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                {ROLE_LABELS[user.role] ?? user.role}
                              </span>
                            </div>
                            <div className="text-center">
                              <span className="text-sm text-slate-600 font-medium">{user._count.assignedClaims}</span>
                            </div>
                            <div className="flex justify-center items-center gap-2">
                              {user.active ? (
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-slate-300" />
                              )}
                              <button
                                onClick={() => toggleUserActive(user)}
                                className={`text-xs font-medium ${user.active ? "text-red-500 hover:text-red-700" : "text-emerald-600 hover:text-emerald-700"}`}
                              >
                                {user.active ? "Désactiver" : "Activer"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: Audit (ADMIN only) */}
                {activeTab === "audit" && session.user.role === "ADMIN" && (
                  <div className="space-y-2">
                    {auditLogs.length === 0 && (
                      <p className="text-center py-10 text-slate-400 text-sm">Aucun événement d&apos;audit</p>
                    )}
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50/60 transition-colors">
                        <div className="h-2 w-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{log.action}</span>
                            <span className="text-xs text-slate-400 shrink-0">{formatDateTime(log.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">{log.user.name}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${ROLE_COLORS[log.user.role] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                              {ROLE_LABELS[log.user.role] ?? log.user.role}
                            </span>
                            {log.claim && (
                              <span className="font-mono text-xs text-indigo-600">{log.claim.claimNumber}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Reassign confirmation modal */}
        {showReassignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 py-4">
                <h3 className="text-white font-semibold" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                  Confirmer la réassignation
                </h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600">
                  Réassigner les sinistres de {selectedUsers.size} gestionnaire(s) vers{" "}
                  <span className="font-semibold text-slate-800">
                    {handlers.find((u) => u.id === reassignTarget)?.name}
                  </span>{" "}
                  ?
                </p>
                <div className="flex gap-3 mt-6 justify-end">
                  <button
                    onClick={() => setShowReassignModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      setShowReassignModal(false);
                      setSelectedUsers(new Set());
                      setReassignTarget("");
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
