"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  EvaluationComponent,
  EvaluationTypeConfig,
} from "@/lib/validations/period";

interface EvaluationSummaryCardProps {
  evaluationTypeLabel: string;
  selectedComponents: EvaluationComponent[];
  totalWeight: number;
}

export function EvaluationSummaryCard({
  evaluationTypeLabel,
  selectedComponents,
  totalWeight,
}: EvaluationSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">
          Ringkasan Komponen
        </CardTitle>
        <p className="mt-1 text-xs text-gray-500">{evaluationTypeLabel}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {selectedComponents.length}
            </p>
            <p className="text-xs text-gray-500">Total Komponen</p>
          </div>
          <div
            className={`rounded-lg p-3 text-center ${
              totalWeight === 100
                ? "bg-green-50"
                : totalWeight > 100
                  ? "bg-red-50"
                  : "bg-gray-50"
            }`}
          >
            <p
              className={`text-2xl font-bold ${
                totalWeight === 100
                  ? "text-green-700"
                  : totalWeight > 100
                    ? "text-red-700"
                    : "text-gray-900"
              }`}
            >
              {totalWeight}%
            </p>
            <p className="text-xs text-gray-500">Total Bobot</p>
          </div>
        </div>

        {selectedComponents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
              Komponen Terpilih
            </p>
            <div className="space-y-2">
              {selectedComponents.map((component) => (
                <div
                  key={component.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-2"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {component.code}
                  </span>
                  <Badge variant="secondary">{component.weight}%</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalWeight !== 100 && totalWeight > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-700">Total bobot harus 100%</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AllPhasesSummaryCardProps {
  evaluationTypes: { id: string; label: string }[];
  evaluationConfigs: Record<string, EvaluationTypeConfig>;
  selectedEvaluationType: string;
}

export function AllPhasesSummaryCard({
  evaluationTypes,
  evaluationConfigs,
  selectedEvaluationType,
}: AllPhasesSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">
          Ringkasan Semua Fase
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {evaluationTypes.map((type) => {
          const config = evaluationConfigs[type.id];
          const selectedCount =
            config?.components?.filter((c: EvaluationComponent) => c.selected)
              .length || 0;
          const weight = config?.totalWeight || 0;
          return (
            <div
              key={type.id}
              className={`flex items-center justify-between rounded-lg p-2 ${
                selectedEvaluationType === type.id
                  ? "border border-blue-200 bg-blue-50"
                  : "bg-gray-50"
              }`}
            >
              <span className="text-sm font-medium text-gray-700">
                {type.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {selectedCount} komponen
                </span>
                {weight > 0 && (
                  <Badge
                    variant={weight === 100 ? "default" : "secondary"}
                    className={
                      weight === 100
                        ? "bg-green-600"
                        : weight > 100
                          ? "bg-red-600"
                          : ""
                    }
                  >
                    {weight}%
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
