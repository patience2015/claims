"use client";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { Users, Download, Shield, CheckCircle, XCircle, Plus } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "HANDLER", label: "Gestionnaire" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Administrateur" },
];

const ROLE_LABELS: Record<string, string> = { HANDLER: "Gestionnaire", MANAGER: "Manager", ADMIN: "Administrateur" };

interface User {
  id: string; email: string; name: string; role: string; active: boolean;
  createdAt: string; _count: { assignedClaims: number };
}

interface AuditLog {
  id: string; action: string; entityType: string;
  user: { name: string; role: string };
  claim: { claimNumber: string } | null;
  createdAt: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "HANDLER" });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [ur, lr] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/audit-logs?pageSize=20"),
    ]);
    const ud = await ur.json();
    const ld = await lr.json();
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
    const data = await res.json();
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
            <p className="text-gray-500 text-sm mt-1">Gestion des utilisateurs et configuration</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportCSV} disabled={exportLoading}>
              {exportLoading ? <Spinner size="sm" className="mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Exporter CSV
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />Nouvel utilisateur
            </Button>
          </div>
        </div>

        {showCreateForm && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader><CardTitle className="text-base">Créer un utilisateur</CardTitle></CardHeader>
            <CardContent>
              {formError && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Prénom Nom" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@claimflow.fr" />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe</Label>
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 caractères" />
                </div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <Select options={ROLE_OPTIONS} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button onClick={createUser} disabled={formLoading}>
                  {formLoading ? <Spinner size="sm" className="mr-2" /> : null}Créer
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>Annuler</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />Utilisateurs ({users.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Spinner className="text-blue-600" /></div>
                ) : (
                  <div className="space-y-3">
                    {users.map(user => (
                      <div key={user.id} className={`flex items-center justify-between p-3 rounded-lg border ${user.active ? "bg-white" : "bg-gray-50 opacity-60"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${user.active ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
                            <span className="text-sm font-semibold">{user.name.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">{user.name}</div>
                            <div className="text-xs text-gray-400">{user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                          <span className="text-xs text-gray-400">{user._count.assignedClaims} dossiers</span>
                          {user.active ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-gray-400" />}
                          <Button variant="ghost" size="sm" onClick={() => toggleUserActive(user)} title={user.active ? "Désactiver" : "Activer"} className="text-xs">
                            {user.active ? "Désactiver" : "Activer"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />Journal d&apos;audit
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-4"><Spinner className="text-blue-600" /></div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map(log => (
                      <div key={log.id} className="text-xs border-b pb-2 last:border-0">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">{log.action}</span>
                          <span className="text-gray-400">{new Date(log.createdAt).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <div className="text-gray-500">{log.user.name}{log.claim && ` · ${log.claim.claimNumber}`}</div>
                      </div>
                    ))}
                    {auditLogs.length === 0 && <p className="text-gray-400 text-sm">Aucun événement</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
