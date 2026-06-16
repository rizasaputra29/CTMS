"use client";

import { useState, useEffect, useCallback } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  Copy,
  Users,
  Plus,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import type {
  PeriodFormData,
  EvaluationComponent,
  PeerReviewIndicator,
  AssessmentTemplate,
} from "@/lib/validations/period";
import {
  EvaluationSummaryCard,
  AllPhasesSummaryCard,
} from "@/app/admin/periods/components/evaluation/EvaluationSummaryCard";
import { EvaluationTypePanel } from "@/app/admin/periods/components/evaluation/EvaluationTypePanel";
import { PeerReviewPanel } from "@/app/admin/periods/components/evaluation/PeerReviewPanel";

type EvaluationTypeId =
  | "sidang_ta"
  | "expo"
  | "bimbingan_sempro"
  | "bimbingan_ta"
  | "nilai_dosen"
  | "milestone";

interface Period {
  id: number;
  name: string;
}

interface EvaluationSetupStepProps {
  evaluationSetup: { hasTemplates: boolean; message: string } | null;
  checkingSetup: boolean;
  periodId?: string;
}

const EVALUATION_TYPES = [
  {
    id: "sidang_ta" as EvaluationTypeId,
    label: "SIDANG TA",
    apiType: "SIDANG_TA",
  },
  { id: "expo" as EvaluationTypeId, label: "EXPO", apiType: "EXPO" },
  {
    id: "bimbingan_sempro" as EvaluationTypeId,
    label: "BIMBINGAN SEMPRO",
    apiType: "BIMBINGAN_SEMPRO",
  },
  {
    id: "bimbingan_ta" as EvaluationTypeId,
    label: "BIMBINGAN TA",
    apiType: "BIMBINGAN_TA",
  },
  {
    id: "nilai_dosen" as EvaluationTypeId,
    label: "NILAI DOSEN",
    apiType: "NILAI_DOSEN",
  },
  {
    id: "milestone" as EvaluationTypeId,
    label: "MILESTONE",
    apiType: "MILESTONE",
  },
];

export function EvaluationSetupStep({
  evaluationSetup,
  checkingSetup,
  periodId,
}: EvaluationSetupStepProps) {
  const [activeMainTab, setActiveMainTab] = useState("tipe_penilaian");
  const [selectedEvaluationType, setSelectedEvaluationType] =
    useState<EvaluationTypeId>("sidang_ta");
  const [availablePeriods, setAvailablePeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [peerReviewSearchQuery, setPeerReviewSearchQuery] = useState("");
  const [assessmentTemplates, setAssessmentTemplates] = useState<
    AssessmentTemplate[]
  >([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const { control, watch, setValue } = useFormContext<PeriodFormData>();
  const evaluationConfigs = watch("evaluation_configs") || {};
  const peerReviewConfig = watch("peer_review_config") || {
    indicators: [],
    enabled: false,
    totalWeight: 0,
  };

  const fetchAssessmentTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await api.get("/admin/assessment-templates");
      const allTemplates: AssessmentTemplate[] = response.data?.data || [];
      const activeTemplates = allTemplates.filter((t) => {
        return (
          t.is_active === true ||
          t.is_active === 1 ||
          t.is_active === "1" ||
          t.is_active === "Active" ||
          t.is_active === "active"
        );
      });
      setAssessmentTemplates(activeTemplates);
      if (activeTemplates.length === 0 && allTemplates.length > 0) {
        toast.warning(
          `${allTemplates.length} template ditemukan tapi tidak ada yang aktif. Silakan aktifkan template di Assessment Bank.`
        );
      }
    } catch (error: unknown) {
      console.error("Failed to fetch assessment templates:", error);
      const msg = api.isAxiosError(error)
        ? error.response?.data?.message
        : "Unknown error";
      toast.error(`Gagal memuat template penilaian: ${msg}`);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadPeriodConfigurations = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const configs: PeriodFormData["evaluation_configs"] = {
        sidang_ta: { components: [], totalWeight: 0 },
        expo: { components: [], totalWeight: 0 },
        bimbingan_sempro: { components: [], totalWeight: 0 },
        bimbingan_ta: { components: [], totalWeight: 0 },
        nilai_dosen: { components: [], totalWeight: 0 },
        milestone: { components: [], totalWeight: 0 },
      };
      let hasConfigs = false;
      const configResults = await Promise.allSettled(
        EVALUATION_TYPES.map((type) =>
          api.get(`/admin/periods/${periodId}/assessment-config?type=${type.apiType}`)
        )
      );
      EVALUATION_TYPES.forEach((type, index) => {
        const result = configResults[index];
        if (result.status === "rejected") return;
        const data = result.value.data?.data;
        if (data?.selected_components) {
          configs[type.id] = {
            components: data.selected_components.map(
              (c: Record<string, unknown>) => ({
                id: String(c.id),
                code: c.code as string,
                name: c.name as string,
                description: c.description as string | null,
                weight: Number(c.weight),
                template_id: c.template_id as number,
                selected: true,
              })
            ),
            totalWeight: data.selected_components.reduce(
              (sum: number, c: Record<string, unknown>) =>
                sum + Number(c.weight),
              0
            ),
          };
          hasConfigs = true;
        }
      });
      if (hasConfigs) {
        setValue("evaluation_configs", configs);
      }
      try {
        const peerResponse = await api.get(
          `/admin/periods/${periodId}/peer-review-config`
        );
        const peerData = peerResponse.data?.data;
        if (peerData) {
          setValue("peer_review_config", {
            indicators: peerData.indicators || [],
            enabled: peerData.enabled || false,
            totalWeight: peerData.total_weight || 0,
          });
        }
      } catch {
        // No peer review config
      }
    } catch (error) {
      console.error("Failed to load configurations:", error);
    } finally {
      setLoading(false);
    }
  }, [periodId, setValue]);

  const fetchAvailablePeriods = async () => {
    try {
      const response = await api.get("/admin/periods");
      setAvailablePeriods(response.data?.data || []);
    } catch {
      setAvailablePeriods([]);
    }
  };

  useEffect(() => {
    Promise.all([fetchAssessmentTemplates(), fetchAvailablePeriods()]);
  }, []);

  useEffect(() => {
    if (periodId) {
      loadPeriodConfigurations();
    }
  }, [periodId, loadPeriodConfigurations]);

  const handleCopyFromPeriod = async (sourcePeriodId: string) => {
    if (!periodId || periodId === "new") {
      toast.error(
        "Silakan simpan periode terlebih dahulu sebelum menyalin konfigurasi"
      );
      return;
    }
    setLoading(true);
    try {
      const response = await api.post(
        `/admin/periods/${periodId}/assessment-config/copy`,
        { source_period_id: sourcePeriodId }
      );
      if (response.status === 201) {
        await loadPeriodConfigurations();
        toast.success("Konfigurasi berhasil disalin");
      }
    } catch (error) {
      console.error("Failed to copy config:", error);
      toast.error("Gagal menyalin konfigurasi");
    } finally {
      setLoading(false);
    }
  };

  const getComponentsForType = (): EvaluationComponent[] => {
    return assessmentTemplates.map((t) => ({
      id: String(t.id),
      code: t.code,
      name: t.name,
      description: t.description,
      weight: Number(t.weight),
      template_id: t.id,
      selected: false,
    }));
  };

  const toggleComponent = (componentId: string | number) => {
    const currentConfig = evaluationConfigs[selectedEvaluationType] || {
      components: [],
      totalWeight: 0,
    };
    const currentComponents = currentConfig.components || [];
    let updatedComponents: EvaluationComponent[];
    if (currentComponents.length === 0) {
      const available = getComponentsForType();
      updatedComponents = available.map((c) =>
        String(c.id) === String(componentId) ? { ...c, selected: true } : c
      );
    } else {
      updatedComponents = currentComponents.map((c) =>
        String(c.id) === String(componentId)
          ? { ...c, selected: !c.selected }
          : c
      );
    }
    const selected = updatedComponents.filter((c) => c.selected);
    setValue(`evaluation_configs.${selectedEvaluationType}`, {
      components: updatedComponents,
      totalWeight: selected.reduce((sum, c) => sum + c.weight, 0),
    });
  };

  const toggleAllComponents = (checked: boolean) => {
    const currentConfig = evaluationConfigs[selectedEvaluationType] || {
      components: [],
      totalWeight: 0,
    };
    const currentComponents = currentConfig.components || [];
    let updatedComponents: EvaluationComponent[];
    if (currentComponents.length === 0) {
      updatedComponents = getComponentsForType().map((c) => ({
        ...c,
        selected: checked,
      }));
    } else {
      updatedComponents = currentComponents.map((c) => ({
        ...c,
        selected: checked,
      }));
    }
    const totalWeight = checked
      ? updatedComponents.reduce((sum, c) => sum + c.weight, 0)
      : 0;
    setValue(`evaluation_configs.${selectedEvaluationType}`, {
      components: updatedComponents,
      totalWeight,
    });
  };

  const getPeerReviewIndicators = (): PeerReviewIndicator[] => {
    return assessmentTemplates.map((t) => ({
      id: String(t.id),
      code: t.code,
      name: t.name,
      description: t.description,
      weight: Number(t.weight),
      template_id: t.id,
      selected: false,
    }));
  };

  const togglePeerReviewIndicator = (indicatorId: string | number) => {
    const currentIndicators = peerReviewConfig.indicators || [];
    let updated: PeerReviewIndicator[];
    if (currentIndicators.length === 0) {
      updated = getPeerReviewIndicators().map((ind) =>
        String(ind.id) === String(indicatorId)
          ? { ...ind, selected: true }
          : ind
      );
    } else {
      updated = currentIndicators.map((ind) =>
        String(ind.id) === String(indicatorId)
          ? { ...ind, selected: !ind.selected }
          : ind
      );
    }
    const selected = updated.filter((i) => i.selected);
    setValue("peer_review_config", {
      indicators: updated,
      enabled: selected.length > 0,
      totalWeight: selected.reduce((sum, i) => sum + i.weight, 0),
    });
  };

  const toggleAllPeerReviewIndicators = (checked: boolean) => {
    const currentIndicators = peerReviewConfig.indicators || [];
    let updated: PeerReviewIndicator[];
    if (currentIndicators.length === 0) {
      updated = getPeerReviewIndicators().map((ind) => ({
        ...ind,
        selected: checked,
      }));
    } else {
      updated = currentIndicators.map((ind) => ({ ...ind, selected: checked }));
    }
    setValue("peer_review_config", {
      indicators: updated,
      enabled: checked,
      totalWeight: checked ? updated.reduce((sum, i) => sum + i.weight, 0) : 0,
    });
  };

  const handleSaveConfiguration = async () => {
    let hasError = false;
    EVALUATION_TYPES.forEach((type) => {
      const config = evaluationConfigs[type.id];
      if (config && config.totalWeight > 0 && config.totalWeight !== 100) {
        toast.error(`${type.label}: Total bobot harus 100%`);
        hasError = true;
      }
    });
    if (peerReviewConfig.enabled && peerReviewConfig.totalWeight !== 100) {
      toast.error("Peer Review: Total bobot harus 100%");
      hasError = true;
    }
    if (!hasError && periodId) {
      try {
        setLoading(true);
        for (const type of EVALUATION_TYPES) {
          const config = evaluationConfigs[type.id];
          if (config?.components?.some((c) => c.selected)) {
            const templateIds = config.components
              .filter((c) => c.selected && c.template_id)
              .map((c) => c.template_id);
            if (templateIds.length > 0) {
              await api.post(`/admin/periods/${periodId}/assessment-config`, {
                type: type.apiType,
                template_ids: templateIds,
              });
            }
          }
        }
        if (peerReviewConfig.enabled) {
          const indicatorIds =
            peerReviewConfig.indicators
              ?.filter((i) => i.selected && i.template_id)
              ?.map((i) => i.template_id) || [];
          await api.post(`/admin/periods/${periodId}/peer-review-config`, {
            enabled: peerReviewConfig.enabled,
            indicator_ids: indicatorIds,
          });
        }
        toast.success("Konfigurasi evaluasi berhasil disimpan");
      } catch {
        toast.error("Gagal menyimpan konfigurasi");
      } finally {
        setLoading(false);
      }
    } else if (!hasError) {
      toast.success(
        "Konfigurasi tersimpan (akan disimpan saat membuat periode)"
      );
    }
  };

  // Derived state
  const currentConfig = evaluationConfigs[selectedEvaluationType] || {
    components: [],
    totalWeight: 0,
  };
  const currentComponents = currentConfig.components || [];
  const filteredComponents = (
    currentComponents.length === 0 && !loadingTemplates
      ? getComponentsForType()
      : currentComponents
  ).filter(
    (c) =>
      (c.description?.toLowerCase() || "").includes(
        searchQuery.toLowerCase()
      ) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedComponents = currentComponents.filter((c) => c.selected);
  const currentTotalWeight = currentConfig.totalWeight || 0;

  const currentPeerIndicators = peerReviewConfig.indicators || [];
  const filteredPeerIndicators = (
    currentPeerIndicators.length === 0 && !loadingTemplates
      ? getPeerReviewIndicators()
      : currentPeerIndicators
  ).filter(
    (ind) =>
      ind.name.toLowerCase().includes(peerReviewSearchQuery.toLowerCase()) ||
      (ind.description?.toLowerCase() || "").includes(
        peerReviewSearchQuery.toLowerCase()
      )
  );
  const selectedPeerIndicators = currentPeerIndicators.filter(
    (i) => i.selected
  );

  if (checkingSetup || loadingTemplates) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-600">Memeriksa konfigurasi evaluasi...</p>
      </div>
    );
  }

  if (!evaluationSetup?.hasTemplates && assessmentTemplates.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-amber-100 p-2">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-900">
                Setup Evaluasi Diperlukan
              </h3>
              <p className="mt-2 text-sm text-amber-700">
                {evaluationSetup?.message ||
                  "Konfigurasi template evaluasi harus diselesaikan sebelum membuat periode."}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => window.open("/admin/assessment-bank", "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Buka Assessment Bank
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Setup Evaluasi Siap</p>
              <p className="text-sm text-green-700">
                {assessmentTemplates.length} template tersedia
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open("/admin/assessment-bank", "_blank")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Template
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Salin Penilaian dari Periode:
          </span>
        </div>
        <Select
          onValueChange={handleCopyFromPeriod}
          disabled={loading || !periodId || periodId === "new"}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue
              placeholder={loading ? "Memuat..." : "Pilih periode..."}
            />
          </SelectTrigger>
          <SelectContent>
            {availablePeriods.map((period) => (
              <SelectItem key={period.id} value={String(period.id)}>
                {period.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs
        value={activeMainTab}
        onValueChange={setActiveMainTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tipe_penilaian">Tipe Penilaian</TabsTrigger>
          <TabsTrigger value="peer_review">Peer Review</TabsTrigger>
        </TabsList>

        <TabsContent value="tipe_penilaian" className="mt-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4 space-y-4">
              <EvaluationSummaryCard
                evaluationTypeLabel={
                  EVALUATION_TYPES.find((t) => t.id === selectedEvaluationType)
                    ?.label || ""
                }
                selectedComponents={selectedComponents}
                totalWeight={currentTotalWeight}
              />
              <AllPhasesSummaryCard
                evaluationTypes={EVALUATION_TYPES}
                evaluationConfigs={evaluationConfigs}
                selectedEvaluationType={selectedEvaluationType}
              />
            </div>
            <EvaluationTypePanel
              evaluationTypes={EVALUATION_TYPES}
              selectedEvaluationType={selectedEvaluationType}
              onSelectType={(id) =>
                setSelectedEvaluationType(id as EvaluationTypeId)
              }
              evaluationConfigs={evaluationConfigs}
              filteredComponents={filteredComponents}
              selectedComponents={selectedComponents}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onToggleComponent={toggleComponent}
              onToggleAll={toggleAllComponents}
            />
          </div>
        </TabsContent>

        <TabsContent value="peer_review" className="mt-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900">
                    Ringkasan Peer Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <Controller
                      name="peer_review_config.enabled"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-blue-600"
                        />
                      )}
                    />
                  </div>
                  {peerReviewConfig.enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-2xl font-bold text-gray-900">
                            {selectedPeerIndicators.length}
                          </p>
                          <p className="text-xs text-gray-500">
                            Total Indikator
                          </p>
                        </div>
                        <div
                          className={`rounded-lg p-3 text-center ${peerReviewConfig.totalWeight === 100 ? "bg-green-50" : peerReviewConfig.totalWeight > 100 ? "bg-red-50" : "bg-gray-50"}`}
                        >
                          <p
                            className={`text-2xl font-bold ${peerReviewConfig.totalWeight === 100 ? "text-green-700" : peerReviewConfig.totalWeight > 100 ? "text-red-700" : "text-gray-900"}`}
                          >
                            {peerReviewConfig.totalWeight}%
                          </p>
                          <p className="text-xs text-gray-500">Total Bobot</p>
                        </div>
                      </div>
                      {selectedPeerIndicators.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                            Indikator Terpilih
                          </p>
                          <div className="space-y-2">
                            {selectedPeerIndicators.map((indicator) => (
                              <div
                                key={indicator.id}
                                className="flex items-center justify-between rounded-lg bg-gray-50 p-2"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-700">
                                    {indicator.name}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {indicator.description}
                                  </span>
                                </div>
                                <Badge variant="secondary">
                                  {indicator.weight}%
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {peerReviewConfig.totalWeight !== 100 &&
                        selectedPeerIndicators.length > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs text-amber-700">
                              Total bobot harus 100%
                            </p>
                          </div>
                        )}
                    </>
                  )}
                  {!peerReviewConfig.enabled && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-center text-xs text-gray-500">
                        Aktifkan peer review untuk mengkonfigurasi indikator
                        penilaian
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Tentang Peer Review
                      </p>
                      <p className="mt-1 text-xs text-blue-700">
                        Peer review memungkinkan mahasiswa menilai kontribusi
                        anggota kelompoknya dalam proyek.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <PeerReviewPanel
              enabled={peerReviewConfig.enabled}
              filteredIndicators={filteredPeerIndicators}
              selectedIndicators={selectedPeerIndicators}
              searchQuery={peerReviewSearchQuery}
              onSearchChange={setPeerReviewSearchQuery}
              onToggleIndicator={togglePeerReviewIndicator}
              onToggleAll={toggleAllPeerReviewIndicators}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end border-t pt-4">
        <Button
          type="button"
          onClick={handleSaveConfiguration}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            "Simpan Konfigurasi"
          )}
        </Button>
      </div>
    </div>
  );
}
