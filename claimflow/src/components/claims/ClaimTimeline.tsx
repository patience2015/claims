"use client";
import { formatDateTime } from "@/lib/utils";
import { CLAIM_STATUS_LABELS } from "@/types";
import { Clock, User, Brain, FileText, MessageSquare, CheckCircle } from "lucide-react";

interface TimelineEvent {
  id: string;
  action: string;
  entityType: string;
  before?: string | null;
  after?: string | null;
  metadata?: string | null;
  user: { name: string; role: string };
  createdAt: string;
}

interface ClaimTimelineProps {
  events: TimelineEvent[];
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  CLAIM_CREATED: { icon: FileText, color: "text-blue-600 bg-blue-100", label: "Création" },
  CLAIM_UPDATED: { icon: FileText, color: "text-yellow-600 bg-yellow-100", label: "Modification" },
  STATUS_CHANGED: { icon: CheckCircle, color: "text-purple-600 bg-purple-100", label: "Changement de statut" },
  AI_ANALYSIS_RUN: { icon: Brain, color: "text-indigo-600 bg-indigo-100", label: "Analyse IA" },
  DOCUMENT_UPLOADED: { icon: FileText, color: "text-green-600 bg-green-100", label: "Document ajouté" },
  COMMENT_ADDED: { icon: MessageSquare, color: "text-gray-600 bg-gray-100", label: "Commentaire" },
  CLAIM_ASSIGNED: { icon: User, color: "text-orange-600 bg-orange-100", label: "Attribution" },
};

function getEventDescription(event: TimelineEvent): string {
  try {
    const after = event.after ? JSON.parse(event.after) : null;
    const before = event.before ? JSON.parse(event.before) : null;

    if (event.action === "STATUS_CHANGED" && before?.status && after?.status) {
      const fromLabel = CLAIM_STATUS_LABELS[before.status as keyof typeof CLAIM_STATUS_LABELS] || before.status;
      const toLabel = CLAIM_STATUS_LABELS[after.status as keyof typeof CLAIM_STATUS_LABELS] || after.status;
      return `${fromLabel} → ${toLabel}`;
    }
    if (event.action === "CLAIM_ASSIGNED" && after?.assignedTo) {
      return `Attribué à ${after.assignedTo}`;
    }
    if (event.action === "AI_ANALYSIS_RUN" && after?.analysisTypes) {
      return `Types: ${Array.isArray(after.analysisTypes) ? after.analysisTypes.join(", ") : after.analysisTypes}`;
    }
  } catch {}
  return "";
}

export function ClaimTimeline({ events }: ClaimTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Aucun événement enregistré</p>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, i) => {
          const config = ACTION_CONFIG[event.action] || {
            icon: Clock,
            color: "text-gray-600 bg-gray-100",
            label: event.action,
          };
          const Icon = config.icon;
          const description = getEventDescription(event);

          return (
            <li key={event.id}>
              <div className="relative pb-8">
                {i < events.length - 1 && (
                  <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-900 font-medium">{config.label}</p>
                      {description && <p className="text-xs text-gray-500">{description}</p>}
                      <p className="text-xs text-gray-400">{event.user.name}</p>
                    </div>
                    <div className="whitespace-nowrap text-right text-xs text-gray-500">
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
