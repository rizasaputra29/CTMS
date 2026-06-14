"use client";

import { Search, Plus, Star, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PeerReviewIndicator } from "@/lib/validations/period";

interface PeerReviewPanelProps {
  enabled: boolean;
  filteredIndicators: PeerReviewIndicator[];
  selectedIndicators: PeerReviewIndicator[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleIndicator: (indicatorId: string | number) => void;
  onToggleAll: (checked: boolean) => void;
}

export function PeerReviewPanel({
  enabled,
  filteredIndicators,
  selectedIndicators,
  searchQuery,
  onSearchChange,
  onToggleIndicator,
  onToggleAll,
}: PeerReviewPanelProps) {
  if (!enabled) {
    return (
      <div className="col-span-8 space-y-4">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-gray-50 py-16">
          <Users className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900">
            Peer Review Dinonaktifkan
          </h3>
          <p className="mt-2 max-w-md text-center text-sm text-gray-500">
            Aktifkan peer review di panel kiri untuk mengkonfigurasi indikator
            penilaian antar mahasiswa
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-8 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Cari indikator..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={
                    selectedIndicators.length > 0 &&
                    selectedIndicators.length === filteredIndicators.length
                  }
                  onCheckedChange={(checked) => onToggleAll(!!checked)}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Kode
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Indikator
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
            {filteredIndicators.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada indikator peer review yang tersedia.
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
              filteredIndicators.map((indicator) => (
                <tr key={indicator.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={indicator.selected}
                      onCheckedChange={() => onToggleIndicator(indicator.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-blue-600">
                      {indicator.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-gray-900">
                        {indicator.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {indicator.description}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className="text-xs">
                      {indicator.weight}%
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
