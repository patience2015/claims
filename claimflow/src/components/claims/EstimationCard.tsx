"use client";
import { EstimationResult } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, Info } from "lucide-react";

interface EstimationCardProps {
  estimation: EstimationResult;
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Faible", color: "text-red-600" },
  medium: { label: "Moyenne", color: "text-yellow-600" },
  high: { label: "Élevée", color: "text-green-600" },
};

export function EstimationCard({ estimation }: EstimationCardProps) {
  const conf = CONFIDENCE_LABELS[estimation.confidence] || { label: estimation.confidence, color: "text-gray-600" };

  return (
    <Card className="border-2 border-blue-100 bg-blue-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Estimation d&apos;indemnisation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main estimate */}
        <div className="text-center py-2">
          <div className="text-3xl font-bold text-blue-700">
            {formatCurrency(estimation.estimatedTotal)}
          </div>
          <div className="text-sm text-gray-600">Montant probable</div>
        </div>

        {/* Min / Max range */}
        <div className="flex justify-between items-center bg-white rounded p-3 text-sm">
          <div className="text-center">
            <div className="text-gray-500">Minimum</div>
            <div className="font-semibold text-gray-800">{formatCurrency(estimation.min)}</div>
          </div>
          <div className="h-px flex-1 bg-gray-200 mx-3" />
          <div className="text-center">
            <div className="text-blue-600 font-medium">Probable</div>
            <div className="font-bold text-blue-700">{formatCurrency(estimation.estimatedTotal)}</div>
          </div>
          <div className="h-px flex-1 bg-gray-200 mx-3" />
          <div className="text-center">
            <div className="text-gray-500">Maximum</div>
            <div className="font-semibold text-gray-800">{formatCurrency(estimation.max)}</div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Ventilation</h4>
          {estimation.breakdown.parts > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Pièces détachées</span>
              <span className="font-medium">{formatCurrency(estimation.breakdown.parts)}</span>
            </div>
          )}
          {estimation.breakdown.labor > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Main d&apos;oeuvre</span>
              <span className="font-medium">{formatCurrency(estimation.breakdown.labor)}</span>
            </div>
          )}
          {estimation.breakdown.other > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Autres frais</span>
              <span className="font-medium">{formatCurrency(estimation.breakdown.other)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between text-sm">
            <span className="text-gray-600">Franchise</span>
            <span className="font-medium text-red-600">−{formatCurrency(estimation.franchise)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Net estimé</span>
            <span className="text-blue-700">{formatCurrency(estimation.netEstimate)}</span>
          </div>
        </div>

        {/* Confidence */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Info className="h-3 w-3" />
          <span>Confiance de l&apos;estimation : <span className={`font-medium ${conf.color}`}>{conf.label}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}
