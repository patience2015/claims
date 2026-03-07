"use client";
import { getFraudColor, getFraudBgColor } from "@/lib/utils";
import { FraudAnalysisResult, FraudFactor } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, XCircle, Shield } from "lucide-react";

interface FraudScoreCardProps {
  score: number;
  risk: string;
  factors?: FraudFactor[];
  summary?: string;
  recommendation?: string;
}

export function FraudScoreCard({ score, risk, factors, summary, recommendation }: FraudScoreCardProps) {
  const colorClass = getFraudColor(score);
  const bgClass = getFraudBgColor(score);

  const riskLabel: Record<string, string> = {
    LOW: "Faible",
    MODERATE: "Modéré",
    HIGH: "Élevé",
    CRITICAL: "Critique",
  };

  const RiskIcon = score <= 30 ? CheckCircle : score <= 60 ? AlertTriangle : XCircle;

  return (
    <Card className={`border-2 ${bgClass}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5" />
          Score de fraude
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score gauge */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`text-5xl font-bold ${colorClass}`}>{score}</div>
            <div className="text-xs text-gray-500">/100</div>
          </div>
          <div>
            <div className={`flex items-center gap-1 font-semibold ${colorClass}`}>
              <RiskIcon className="h-4 w-4" />
              Risque {riskLabel[risk] || risk}
            </div>
            {summary && <p className="text-sm text-gray-600 mt-1">{summary}</p>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              score <= 30 ? "bg-green-500" : score <= 60 ? "bg-yellow-500" : score <= 80 ? "bg-red-500" : "bg-red-800"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Fraud factors */}
        {factors && factors.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Indicateurs détectés</h4>
            <div className="space-y-1.5">
              {factors.map((factor, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${factor.detected ? "bg-red-50" : "bg-gray-50"}`}>
                  <div className={`mt-0.5 h-3 w-3 rounded-full flex-shrink-0 ${factor.detected ? "bg-red-500" : "bg-gray-300"}`} />
                  <div>
                    <span className="font-medium">{factor.name}</span>
                    {factor.detected && <span className="text-red-600 ml-1">(+{factor.weight} pts)</span>}
                    <p className="text-gray-500">{factor.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {recommendation && (
          <div className="p-3 bg-white rounded border">
            <p className="text-sm font-medium text-gray-700">Recommandation</p>
            <p className="text-sm text-gray-600 mt-1">{recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
