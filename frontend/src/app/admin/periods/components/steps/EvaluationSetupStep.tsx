'use client';

import { useState, useEffect } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, AlertCircle, CheckCircle, Copy, Search, Filter, ChevronDown, Users, Star, Plus, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { PeriodFormData, EvaluationComponent, PeerReviewIndicator, AssessmentTemplate } from '@/lib/validations/period';

type EvaluationTypeId = 'sidang_ta' | 'expo' | 'bimbingan_sempro' | 'bimbingan_ta' | 'nilai_dosen' | 'milestone';

interface Period {
    id: number;
    name: string;
}

interface EvaluationSetupStepProps {
    evaluationSetup: { hasTemplates: boolean; message: string } | null;
    checkingSetup: boolean;
    periodId?: string;
}

const evaluationTypes = [
    { id: 'sidang_ta' as EvaluationTypeId, label: 'SIDANG TA', apiType: 'SIDANG_TA' },
    { id: 'expo' as EvaluationTypeId, label: 'EXPO', apiType: 'EXPO' },
    { id: 'bimbingan_sempro' as EvaluationTypeId, label: 'BIMBINGAN SEMPRO', apiType: 'BIMBINGAN_SEMPRO' },
    { id: 'bimbingan_ta' as EvaluationTypeId, label: 'BIMBINGAN TA', apiType: 'BIMBINGAN_TA' },
    { id: 'nilai_dosen' as EvaluationTypeId, label: 'NILAI DOSEN', apiType: 'NILAI_DOSEN' },
    { id: 'milestone' as EvaluationTypeId, label: 'MILESTONE', apiType: 'MILESTONE' },
];

export function EvaluationSetupStep({ evaluationSetup, checkingSetup, periodId }: EvaluationSetupStepProps) {
    const [activeMainTab, setActiveMainTab] = useState('tipe_penilaian');
    const [selectedEvaluationType, setSelectedEvaluationType] = useState<EvaluationTypeId>('sidang_ta');
    const [availablePeriods, setAvailablePeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [peerReviewSearchQuery, setPeerReviewSearchQuery] = useState('');
    const [assessmentTemplates, setAssessmentTemplates] = useState<AssessmentTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);

    const { control, watch, setValue } = useFormContext<PeriodFormData>();
    
    const evaluationConfigs = watch('evaluation_configs') || {};
    const peerReviewConfig = watch('peer_review_config') || { indicators: [], enabled: false, totalWeight: 0 };

    useEffect(() => {
        fetchAssessmentTemplates();
        fetchAvailablePeriods();
    }, []);

    useEffect(() => {
        if (periodId) {
            loadPeriodConfigurations();
        }
    }, [periodId]);

    const fetchAssessmentTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const response = await api.get('/admin/assessment-templates');
            console.log('Assessment Templates API Response:', response.data);
            
            const allTemplates = response.data?.data || [];
            console.log('Total templates received:', allTemplates.length);
            
            if (allTemplates.length > 0) {
                console.log('First template is_active value:', allTemplates[0]?.is_active, 'type:', typeof allTemplates[0]?.is_active);
            }
            
            // Filter active templates - handle multiple formats
            const activeTemplates = allTemplates.filter((t: AssessmentTemplate) => {
                const isActive = t.is_active === true || 
                                t.is_active === 1 || 
                                t.is_active === "1" ||
                                t.is_active === "Active" ||
                                t.is_active === "active";
                return isActive;
            });
            
            console.log('Active templates after filter:', activeTemplates.length);
            setAssessmentTemplates(activeTemplates);
            
            if (activeTemplates.length === 0 && allTemplates.length > 0) {
                toast.warning(`${allTemplates.length} template ditemukan tapi tidak ada yang aktif. Silakan aktifkan template di Assessment Bank.`);
            }
        } catch (error: any) {
            console.error('Failed to fetch assessment templates:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
            toast.error(`Gagal memuat template penilaian: ${errorMessage}`);
        } finally {
            setLoadingTemplates(false);
        }
    };

    const loadPeriodConfigurations = async () => {
        if (!periodId) return;
        setLoading(true);
        try {
            // Load all evaluation configs
            const configs: PeriodFormData['evaluation_configs'] = {
                sidang_ta: { components: [], totalWeight: 0 },
                expo: { components: [], totalWeight: 0 },
                bimbingan_sempro: { components: [], totalWeight: 0 },
                bimbingan_ta: { components: [], totalWeight: 0 },
                nilai_dosen: { components: [], totalWeight: 0 },
                milestone: { components: [], totalWeight: 0 },
            };
            let hasConfigs = false;
            
            for (const type of evaluationTypes) {
                try {
                    const response = await api.get(`/admin/periods/${periodId}/assessment-config?type=${type.apiType}`);
                    const data = response.data?.data;
                    if (data?.selected_components) {
                        configs[type.id] = {
                            components: data.selected_components.map((c: any) => ({
                                id: String(c.id),
                                code: c.code,
                                name: c.name,
                                description: c.description,
                                weight: Number(c.weight),
                                template_id: c.template_id,
                                selected: true,
                            })),
                            totalWeight: data.selected_components.reduce((sum: number, c: any) => sum + Number(c.weight), 0),
                        };
                        hasConfigs = true;
                    }
                } catch (e) {
                    console.warn(`No config for ${type.id}`);
                }
            }
            if (hasConfigs) {
                setValue('evaluation_configs', configs);
            }
            // Load peer review
            try {
                const peerResponse = await api.get(`/admin/periods/${periodId}/peer-review-config`);
                const peerData = peerResponse.data?.data;
                if (peerData) {
                    setValue('peer_review_config', {
                        indicators: peerData.indicators || [],
                        enabled: peerData.enabled || false,
                        totalWeight: peerData.total_weight || 0,
                    });
                }
            } catch (e) {
                console.warn('No peer review config');
            }
        } catch (error) {
            console.error('Failed to load configurations:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailablePeriods = async () => {
        try {
            const response = await api.get('/admin/periods');
            setAvailablePeriods(response.data?.data || []);
        } catch {
            setAvailablePeriods([]);
        }
    };

    const handleCopyFromPeriod = async (sourcePeriodId: string) => {
        // Guard: Cannot copy to a new period that hasn't been created yet
        if (!periodId || periodId === 'new') {
            toast.error('Silakan simpan periode terlebih dahulu sebelum menyalin konfigurasi');
            return;
        }
        setLoading(true);
        try {
            const response = await api.post(`/admin/periods/${periodId}/assessment-config/copy`, {
                source_period_id: sourcePeriodId,
            });
            if (response.status === 201) {
                // Reload configurations after successful copy
                await loadPeriodConfigurations();
                toast.success('Konfigurasi berhasil disalin');
            }
        } catch (error) {
            console.error('Failed to copy config:', error);
            toast.error('Gagal menyalin konfigurasi');
        } finally {
            setLoading(false);
        }
    };

    const getComponentsForType = (typeId: EvaluationTypeId): EvaluationComponent[] => {
        // Show ALL active assessment templates for ALL evaluation types
        return assessmentTemplates.map(t => ({
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
        const currentConfig = evaluationConfigs[selectedEvaluationType] || { components: [], totalWeight: 0 };
        const currentComponents = currentConfig.components || [];
        
        let updatedComponents: EvaluationComponent[];
        if (currentComponents.length === 0) {
            const available = getComponentsForType(selectedEvaluationType);
            updatedComponents = available.map(c => String(c.id) === String(componentId) ? { ...c, selected: true } : c);
        } else {
            updatedComponents = currentComponents.map(c => String(c.id) === String(componentId) ? { ...c, selected: !c.selected } : c);
        }
        
        const selected = updatedComponents.filter(c => c.selected);
        setValue(`evaluation_configs.${selectedEvaluationType}`, {
            components: updatedComponents,
            totalWeight: selected.reduce((sum, c) => sum + c.weight, 0),
        });
    };

    const toggleAllComponents = (checked: boolean) => {
        const currentConfig = evaluationConfigs[selectedEvaluationType] || { components: [], totalWeight: 0 };
        const currentComponents = currentConfig.components || [];
        
        let updatedComponents: EvaluationComponent[];
        if (currentComponents.length === 0) {
            updatedComponents = getComponentsForType(selectedEvaluationType).map(c => ({ ...c, selected: checked }));
        } else {
            updatedComponents = currentComponents.map(c => ({ ...c, selected: checked }));
        }
        
        const totalWeight = checked ? updatedComponents.reduce((sum, c) => sum + c.weight, 0) : 0;
        setValue(`evaluation_configs.${selectedEvaluationType}`, { components: updatedComponents, totalWeight });
    };

    const getPeerReviewIndicators = (): PeerReviewIndicator[] => {
        // Show ALL active assessment templates for Peer Review
        return assessmentTemplates.map(t => ({
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
            updated = getPeerReviewIndicators().map(ind => 
                String(ind.id) === String(indicatorId) ? { ...ind, selected: true } : ind
            );
        } else {
            updated = currentIndicators.map(ind => 
                String(ind.id) === String(indicatorId) ? { ...ind, selected: !ind.selected } : ind
            );
        }
        
        const selected = updated.filter(i => i.selected);
        setValue('peer_review_config', {
            indicators: updated,
            enabled: selected.length > 0,
            totalWeight: selected.reduce((sum, i) => sum + i.weight, 0),
        });
    };

    const toggleAllPeerReviewIndicators = (checked: boolean) => {
        const currentIndicators = peerReviewConfig.indicators || [];
        let updated: PeerReviewIndicator[];
        
        if (currentIndicators.length === 0) {
            updated = getPeerReviewIndicators().map(ind => ({ ...ind, selected: checked }));
        } else {
            updated = currentIndicators.map(ind => ({ ...ind, selected: checked }));
        }
        
        setValue('peer_review_config', {
            indicators: updated,
            enabled: checked,
            totalWeight: checked ? updated.reduce((sum, i) => sum + i.weight, 0) : 0,
        });
    };

    const handleSaveConfiguration = async () => {
        let hasError = false;
        
        evaluationTypes.forEach((type) => {
            const config = evaluationConfigs[type.id];
            if (config && config.totalWeight > 0 && config.totalWeight !== 100) {
                toast.error(`${type.label}: Total bobot harus 100%`);
                hasError = true;
            }
        });

        if (peerReviewConfig.enabled && peerReviewConfig.totalWeight !== 100) {
            toast.error('Peer Review: Total bobot harus 100%');
            hasError = true;
        }

        if (!hasError) {
            if (periodId) {
                try {
                    setLoading(true);
                    for (const type of evaluationTypes) {
                        const config = evaluationConfigs[type.id];
                        if (config?.components?.some((c: EvaluationComponent) => c.selected)) {
                            const templateIds = config.components
                                .filter((c: EvaluationComponent) => c.selected && c.template_id)
                                .map((c: EvaluationComponent) => c.template_id);
                            if (templateIds.length > 0) {
                                await api.post(`/admin/periods/${periodId}/assessment-config`, {
                                    type: type.apiType,
                                    template_ids: templateIds,
                                });
                            }
                        }
                    }
                    if (peerReviewConfig.enabled) {
                        const indicatorIds = peerReviewConfig.indicators
                            ?.filter((i: PeerReviewIndicator) => i.selected && i.template_id)
                            ?.map((i: PeerReviewIndicator) => i.template_id) || [];
                        await api.post(`/admin/periods/${periodId}/peer-review-config`, {
                            enabled: peerReviewConfig.enabled,
                            indicator_ids: indicatorIds,
                        });
                    }
                    toast.success('Konfigurasi evaluasi berhasil disimpan');
                } catch (error) {
                    toast.error('Gagal menyimpan konfigurasi');
                } finally {
                    setLoading(false);
                }
            } else {
                toast.success('Konfigurasi tersimpan (akan disimpan saat membuat periode)');
            }
        }
    };

    const getCurrentConfig = () => evaluationConfigs[selectedEvaluationType] || { components: [], totalWeight: 0 };
    
    const getFilteredComponents = () => {
        const config = getCurrentConfig();
        const components = config.components || [];
        if (components.length === 0 && !loadingTemplates) {
            return getComponentsForType(selectedEvaluationType).filter(c => 
                (c.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return components.filter(c => 
            (c.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    const getSelectedComponents = () => (getCurrentConfig().components || []).filter(c => c.selected);
    const getCurrentTotalWeight = () => getCurrentConfig().totalWeight || 0;
    
    const getFilteredPeerReviewIndicators = () => {
        const indicators = peerReviewConfig.indicators || [];
        if (indicators.length === 0 && !loadingTemplates) {
            return getPeerReviewIndicators().filter(ind =>
                ind.name.toLowerCase().includes(peerReviewSearchQuery.toLowerCase()) ||
                (ind.description?.toLowerCase() || '').includes(peerReviewSearchQuery.toLowerCase())
            );
        }
        return indicators.filter(ind =>
            ind.name.toLowerCase().includes(peerReviewSearchQuery.toLowerCase()) ||
            (ind.description?.toLowerCase() || '').includes(peerReviewSearchQuery.toLowerCase())
        );
    };

    const getSelectedPeerReviewIndicators = () => (peerReviewConfig.indicators || []).filter(i => i.selected);

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
            <div className="max-w-2xl mx-auto py-8">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-amber-100 rounded-full">
                            <AlertCircle className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-amber-900">Setup Evaluasi Diperlukan</h3>
                            <p className="text-sm text-amber-700 mt-2">
                                {evaluationSetup?.message || 'Konfigurasi template evaluasi harus diselesaikan sebelum membuat periode.'}
                            </p>
                            <Button type="button" variant="outline" className="mt-4" onClick={() => window.open('/admin/assessment-bank', '_blank')}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Buka Assessment Bank
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const filteredComponents = getFilteredComponents();
    const selectedComponentsList = getSelectedComponents();
    const currentTotalWeight = getCurrentTotalWeight();
    const filteredPeerIndicators = getFilteredPeerReviewIndicators();
    const selectedPeerIndicators = getSelectedPeerReviewIndicators();

    return (
        <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                            <p className="font-medium text-green-900">Setup Evaluasi Siap</p>
                            <p className="text-sm text-green-700">{assessmentTemplates.length} template tersedia</p>
                        </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => window.open('/admin/assessment-bank', '_blank')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah Template
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between pb-4 border-b">
                <div className="flex items-center gap-2">
                    <Copy className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Salin Penilaian dari Periode:</span>
                </div>
                <Select onValueChange={handleCopyFromPeriod} disabled={loading || !periodId || periodId === 'new'}>
                    <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder={loading ? "Memuat..." : "Pilih periode..."} />
                    </SelectTrigger>
                    <SelectContent>
                        {availablePeriods.map((period) => (
                            <SelectItem key={period.id} value={String(period.id)}>{period.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="tipe_penilaian">Tipe Penilaian</TabsTrigger>
                    <TabsTrigger value="peer_review">Peer Review</TabsTrigger>
                </TabsList>

                <TabsContent value="tipe_penilaian" className="mt-6">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-4 space-y-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-gray-900">Ringkasan Komponen</CardTitle>
                                    <p className="text-xs text-gray-500 mt-1">{evaluationTypes.find(t => t.id === selectedEvaluationType)?.label}</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-3 rounded-lg text-center">
                                            <p className="text-2xl font-bold text-gray-900">{selectedComponentsList.length}</p>
                                            <p className="text-xs text-gray-500">Total Komponen</p>
                                        </div>
                                        <div className={`p-3 rounded-lg text-center ${currentTotalWeight === 100 ? 'bg-green-50' : currentTotalWeight > 100 ? 'bg-red-50' : 'bg-gray-50'}`}>
                                            <p className={`text-2xl font-bold ${currentTotalWeight === 100 ? 'text-green-700' : currentTotalWeight > 100 ? 'text-red-700' : 'text-gray-900'}`}>{currentTotalWeight}%</p>
                                            <p className="text-xs text-gray-500">Total Bobot</p>
                                        </div>
                                    </div>
                                    {selectedComponentsList.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Komponen Terpilih</p>
                                            <div className="space-y-2">
                                                {selectedComponentsList.map((component) => (
                                                    <div key={component.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                                        <span className="text-sm font-medium text-gray-700">{component.code}</span>
                                                        <Badge variant="secondary">{component.weight}%</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {currentTotalWeight !== 100 && currentTotalWeight > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <p className="text-xs text-amber-700">Total bobot harus 100%</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-gray-900">Ringkasan Semua Fase</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {evaluationTypes.map((type) => {
                                        const config = evaluationConfigs[type.id];
                                        const selectedCount = config?.components?.filter((c: EvaluationComponent) => c.selected).length || 0;
                                        const weight = config?.totalWeight || 0;
                                        return (
                                            <div key={type.id} className={`flex items-center justify-between p-2 rounded-lg ${selectedEvaluationType === type.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                                                <span className="text-sm font-medium text-gray-700">{type.label}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">{selectedCount} komponen</span>
                                                    {weight > 0 && (
                                                        <Badge variant={weight === 100 ? "default" : "secondary"} className={weight === 100 ? "bg-green-600" : weight > 100 ? "bg-red-600" : ""}>{weight}%</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="col-span-8 space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {evaluationTypes.map((type) => {
                                    const config = evaluationConfigs[type.id];
                                    const hasConfig = config?.components?.some((c: EvaluationComponent) => c.selected);
                                    return (
                                        <Button
                                            key={type.id}
                                            type="button"
                                            variant={selectedEvaluationType === type.id ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setSelectedEvaluationType(type.id)}
                                            className="text-xs relative"
                                        >
                                            {type.label}
                                            {hasConfig && selectedEvaluationType !== type.id && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />}
                                        </Button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input placeholder="Cari komponen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                                </div>
                                <Button type="button" variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
                                <Button type="button" variant="outline" size="icon"><ChevronDown className="h-4 w-4" /></Button>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="w-12 px-4 py-3">
                                                <Checkbox checked={selectedComponentsList.length > 0 && selectedComponentsList.length === filteredComponents.length} onCheckedChange={(checked) => toggleAllComponents(!!checked)} />
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Kode</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Nama</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Deskripsi</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Bobot</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredComponents.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                    Tidak ada komponen yang tersedia untuk fase ini.
                                                    <br />
                                                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => window.open('/admin/assessment-bank', '_blank')}>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Tambah Template di Assessment Bank
                                                    </Button>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredComponents.map((component) => (
                                                <tr key={component.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <Checkbox checked={component.selected} onCheckedChange={() => toggleComponent(component.id)} />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-sm font-medium text-blue-600">{component.code}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{component.name}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">{component.description}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge variant="outline" className="text-xs">{component.weight}%</Badge>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="peer_review" className="mt-6">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-4 space-y-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-gray-900">Ringkasan Peer Review</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Status</span>
                                        <Controller
                                            name="peer_review_config.enabled"
                                            control={control}
                                            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-blue-600" />}
                                        />
                                    </div>
                                    {peerReviewConfig.enabled && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-gray-50 p-3 rounded-lg text-center">
                                                    <p className="text-2xl font-bold text-gray-900">{selectedPeerIndicators.length}</p>
                                                    <p className="text-xs text-gray-500">Total Indikator</p>
                                                </div>
                                                <div className={`p-3 rounded-lg text-center ${peerReviewConfig.totalWeight === 100 ? 'bg-green-50' : peerReviewConfig.totalWeight > 100 ? 'bg-red-50' : 'bg-gray-50'}`}>
                                                    <p className={`text-2xl font-bold ${peerReviewConfig.totalWeight === 100 ? 'text-green-700' : peerReviewConfig.totalWeight > 100 ? 'text-red-700' : 'text-gray-900'}`}>{peerReviewConfig.totalWeight}%</p>
                                                    <p className="text-xs text-gray-500">Total Bobot</p>
                                                </div>
                                            </div>
                                            {selectedPeerIndicators.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Indikator Terpilih</p>
                                                    <div className="space-y-2">
                                                        {selectedPeerIndicators.map((indicator) => (
                                                            <div key={indicator.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-gray-700">{indicator.name}</span>
                                                                    <span className="text-xs text-gray-500">{indicator.description}</span>
                                                                </div>
                                                                <Badge variant="secondary">{indicator.weight}%</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {peerReviewConfig.totalWeight !== 100 && selectedPeerIndicators.length > 0 && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                    <p className="text-xs text-amber-700">Total bobot harus 100%</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!peerReviewConfig.enabled && (
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                            <p className="text-xs text-gray-500 text-center">Aktifkan peer review untuk mengkonfigurasi indikator penilaian</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="bg-blue-50 border-blue-200">
                                <CardContent className="pt-4">
                                    <div className="flex items-start gap-3">
                                        <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-blue-900">Tentang Peer Review</p>
                                            <p className="text-xs text-blue-700 mt-1">Peer review memungkinkan mahasiswa menilai kontribusi anggota kelompoknya dalam proyek.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="col-span-8 space-y-4">
                            {!peerReviewConfig.enabled ? (
                                <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border border-dashed">
                                    <Users className="h-12 w-12 text-gray-300 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900">Peer Review Dinonaktifkan</h3>
                                    <p className="text-sm text-gray-500 mt-2 text-center max-w-md">Aktifkan peer review di panel kiri untuk mengkonfigurasi indikator penilaian antar mahasiswa</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <Input placeholder="Cari indikator..." value={peerReviewSearchQuery} onChange={(e) => setPeerReviewSearchQuery(e.target.value)} className="pl-9" />
                                        </div>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="w-12 px-4 py-3">
                                                        <Checkbox checked={selectedPeerIndicators.length > 0 && selectedPeerIndicators.length === filteredPeerIndicators.length} onCheckedChange={(checked) => toggleAllPeerReviewIndicators(!!checked)} />
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Kode</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Indikator</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Deskripsi</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Bobot</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredPeerIndicators.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                            Tidak ada indikator peer review yang tersedia.
                                                            <br />
                                                            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => window.open('/admin/assessment-bank', '_blank')}>
                                                                <Plus className="h-4 w-4 mr-2" />
                                                                Tambah Template di Assessment Bank
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredPeerIndicators.map((indicator) => (
                                                        <tr key={indicator.id} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3">
                                                                <Checkbox checked={indicator.selected} onCheckedChange={() => togglePeerReviewIndicator(indicator.id)} />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-sm font-medium text-blue-600">{indicator.code}</span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Star className="h-4 w-4 text-amber-500" />
                                                                    <span className="text-sm font-medium text-gray-900">{indicator.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-700">{indicator.description}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <Badge variant="outline" className="text-xs">{indicator.weight}%</Badge>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-4 border-t">
                <Button type="button" onClick={handleSaveConfiguration} disabled={loading}>
                    {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : 'Simpan Konfigurasi'}
                </Button>
            </div>
        </div>
    );
}
