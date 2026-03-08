"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, Clock, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TeamMemberStats, SlaReport } from "@/types";

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "90 derniers jours" },
];

interface BulkAssignModalProps {
  selectedCount: number;
  handlers: { id: string; name: string }[];
  onConfirm: (assignToId: string) => Promise<void>;
  onCancel: () => void;
}

function BulkAssignModal({ selectedCount, handlers, onConfirm, onCancel }: BulkAssignModalProps) {
  const [assignToId, setAssignToId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!assignToId) return;
    setLoading(true);
    await onConfirm(assignToId);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Réassignation groupée</h2>
        <p className="text-sm text-gray-500 mb-4">
          {selectedCount} sinistre(s) sélectionné(s) — choisissez le nouveau gestionnaire.
        </p>
        <Select
          options={handlers.map((h) => ({ value: h.id, label: h.name }))}
          value={assignToId}
          onChange={(e) => setAssignToId(e.target.value)}
          placeholder="Sélectionner un gestionnaire"
          className="mb-4"
        />
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!assignToId || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? <Spinner size="sm" className="mr-2" /> : null}
            Confirmer la réassignation
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TeamDashboard() {
  const [period, setPeriod] = useState("30d");
  const [team, setTeam] = useState<TeamMemberStats[]>([]);
  const [sla, setSla] = useState<SlaReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const [teamRes, slaRes] = await Promise.all([
        fetch(`/api/dashboard/team?period=${period}`),
        fetch("/api/dashboard/sla"),
      ]);
      const teamData = await teamRes.json() as { data: TeamMemberStats[] };
      const slaData = await slaRes.json() as { data: SlaReport };
      setTeam(teamData.data ?? []);
      setSla(slaData.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === team.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(team.map((m) => m.userId)));
  };

  const handleBulkAssign = async (assignToId: string) => {
    const res = await fetch("/api/claims/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimIds: team
          .filter((m) => selectedIds.has(m.userId))
          .flatMap(() => []),  // placeholder — in practice claimIds come from a claims selection
        assignToId,
      }),
    });
    if (res.ok) {
      const data = await res.json() as { data: { updated: number } };
      setSuccessMsg(`${data.data.updated} sinistre(s) réassigné(s) avec succès.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
    setShowModal(false);
    setSelectedIds(new Set());
    await fetchData();
  };

  const handlers = team.map((m) => ({ id: m.userId, name: m.name }));

  return (
    <div className="space-y-6">
      {/* SLA summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{sla?.overdue.length ?? 0}</p>
              <p className="text-xs text-red-600 font-medium">SLA dépassé (&gt;30j)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{sla?.atRisk.length ?? 0}</p>
              <p className="text-xs text-amber-600 font-medium">À risque (20–30j)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{sla?.healthyCount ?? 0}</p>
              <p className="text-xs text-green-600 font-medium">Dans les délais</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team table header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            Performance de l&apos;équipe
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              options={PERIOD_OPTIONS}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-44"
              placeholder="Période"
            />
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mx-6 mb-3 flex items-center gap-3 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-2.5">
            <span className="text-sm font-medium text-indigo-800">
              {selectedIds.size} gestionnaire(s) sélectionné(s)
            </span>
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Réassigner les sinistres
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Annuler
            </Button>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mb-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
            {successMsg}
          </div>
        )}

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" className="text-indigo-600" />
            </div>
          ) : team.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Aucun gestionnaire actif</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y border-gray-200">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === team.length && team.length > 0}
                        onChange={toggleAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Gestionnaire</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Assignés</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">En attente</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">SLA dépassé</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Délai moy.</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Taux appro.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {team.map((member) => {
                    const hasSla = member.stats.slaBreached > 0;
                    return (
                      <tr
                        key={member.userId}
                        className={`transition-colors hover:bg-gray-50 ${
                          hasSla ? "border-l-2 border-l-red-400" : ""
                        } ${selectedIds.has(member.userId) ? "bg-indigo-50/40" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(member.userId)}
                            onChange={() => toggleSelect(member.userId)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs shrink-0">
                              {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.name}</p>
                              <p className="text-xs text-gray-400">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {member.stats.total}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-amber-700 font-medium">{member.stats.pending}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {member.stats.slaBreached > 0 ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              {member.stats.slaBreached}
                            </Badge>
                          ) : (
                            <span className="text-green-600 font-medium">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {member.stats.avgProcessingDays}j
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-semibold ${
                              member.stats.approvalRate >= 70
                                ? "text-green-600"
                                : member.stats.approvalRate >= 40
                                ? "text-amber-600"
                                : "text-red-600"
                            }`}
                          >
                            {member.stats.approvalRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SLA overdue list */}
      {sla && sla.overdue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Sinistres SLA dépassé — action requise
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50 border-y border-red-100">
                    <th className="px-4 py-3 text-left font-semibold text-red-700">N° sinistre</th>
                    <th className="px-4 py-3 text-left font-semibold text-red-700">Assuré</th>
                    <th className="px-4 py-3 text-left font-semibold text-red-700">Gestionnaire</th>
                    <th className="px-4 py-3 text-right font-semibold text-red-700">Jours écoulés</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {sla.overdue.map((claim) => (
                    <tr key={claim.id} className="hover:bg-red-50/40">
                      <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-semibold">
                        {claim.claimNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {claim.policyholder.firstName} {claim.policyholder.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {claim.assignedTo?.name ?? <span className="italic text-gray-400">Non assigné</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge className="bg-red-100 text-red-700 border-red-200">
                          {claim.daysSinceUpdate}j
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showModal && (
        <BulkAssignModal
          selectedCount={selectedIds.size}
          handlers={handlers}
          onConfirm={handleBulkAssign}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
