"use client";

import { Search, Filter, ChevronDown, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  EvaluationComponent,
  EvaluationTypeConfig,
} from "@/lib/validations/period";

interface EvaluationTypeOption {
  id: string;
  label: string;
}

interface EvaluationTypePanelProps {
  evaluationTypes: EvaluationTypeOption[];
  selectedEvaluationType: string;
  onSelectType: (typeId: string) => void;
  evaluationConfigs: Record<string, EvaluationTypeConfig>;
  filteredComponents: EvaluationComponent[];
  selectedComponents: EvaluationComponent[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleComponent: (componentId: string | number) => void;
  onToggleAll: (checked: boolean) => void;
}

export function EvaluationTypePanel({
  evaluationTypes,
  selectedEvaluationType,
  onSelectType,
  evaluationConfigs,
  filteredComponents,
  selectedComponents,
  searchQuery,
  onSearchChange,
  onToggleComponent,
  onToggleAll,
}: EvaluationTypePanelProps) {
  return (
    <div className="col-span-8 space-y-4">
      <div className="flex flex-wrap gap-2">
        {evaluationTypes.map((type) => {
          const config = evaluationConfigs[type.id];
          const hasConfig = config?.components?.some(
            (c: EvaluationComponent) => c.selected
          );
          return (
            <Button
              key={type.id}
              type="button"
              variant={
                selectedEvaluationType === type.id ? "default" : "outline"
              }
              size="sm"
              onClick={() => onSelectType(type.id)}
              className="text-xs"
            >
              {type.label}
              {hasConfig && selectedEvaluationType !== type.id && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
              )}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Cari komponen..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon">
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={
                    selectedComponents.length > 0 &&
                    selectedComponents.length === filteredComponents.length
                  }
                  onCheckedChange={(checked) => onToggleAll(!!checked)}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Kode
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Nama
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Deskripsi
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                Bobot
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredComponents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada komponen yang tersedia untuk fase ini.
                  <br />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      window.open("/admin/assessment-bank", "_blank")
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Template di Assessment Bank
                  </Button>
                </td>
              </tr>
            ) : (
              filteredComponents.map((component) => (
                <tr key={component.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={component.selected}
                      onCheckedChange={() => onToggleComponent(component.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-blue-600">
                      {component.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {component.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {component.description}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className="text-xs">
                      {component.weight}%
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
