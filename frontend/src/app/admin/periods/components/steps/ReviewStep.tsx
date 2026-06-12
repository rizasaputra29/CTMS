'use client';

import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Calendar, Users, BookOpen, Clock, Star, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useState } from 'react';
import type { PeriodFormData, EvaluationComponent, PeerReviewIndicator } from '@/lib/validations/period';

interface ReviewStepProps {
    evaluationSetup: { hasTemplates: boolean; message: string } | null;
}

const evaluationTypes = [
    { id: 'sidang_ta', label: 'SIDANG TA' },
    { id: 'expo', label: 'EXPO' },
    { id: 'bimbingan_sempro', label: 'BIMBINGAN SEMPRO' },
    { id: 'bimbingan_ta', label: 'BIMBINGAN TA' },
    { id: 'nilai_dosen', label: 'NILAI DOSEN' },
    { id: 'milestone', label: 'MILESTONE' },
];

export function ReviewStep({ evaluationSetup }: ReviewStepProps) {
    const { getValues } = useFormContext<PeriodFormData>();
    const values = getValues();
    const [expandedPhases, setExpandedPhases] = useState<string[]>([]);

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return 'Belum diatur';
        try {
            return format(new Date(dateStr), 'dd MMMM yyyy', { locale: id });
        } catch {
            return dateStr;
        }
    };

    const hasPhaseDates = () => {
        return values.bidding_start || values.pdc1_start || values.pdc2_start || 
               values.expo_date || values.ta_start;
    };

    const togglePhaseExpand = (phaseId: string) => {
        setExpandedPhases(prev => 
            prev.includes(phaseId) 
                ? prev.filter(id => id !== phaseId)
                : [...prev, phaseId]
        );
    };

    const evaluationConfigs = values.evaluation_configs || {};
    const peerReviewConfig = values.peer_review_config || { indicators: [], enabled: false, totalWeight: 0 };

    const hasEvaluationConfig = (typeId: string) => {
        const config = evaluationConfigs[typeId as keyof typeof evaluationConfigs];
        return config && config.components && config.components.some((c: EvaluationComponent) => c.selected);
    };

    const getSelectedComponents = (typeId: string) => {
        const config = evaluationConfigs[typeId as keyof typeof evaluationConfigs];
        return config?.components?.filter((c: EvaluationComponent) => c.selected) || [];
    };

    const getConfigTotalWeight = (typeId: string) => {
        const config = evaluationConfigs[typeId as keyof typeof evaluationConfigs];
        return config?.totalWeight || 0;
    };

    const hasAnyEvaluationConfig = () => {
        return evaluationTypes.some(type => hasEvaluationConfig(type.id));
    };

    return (
        <div className="space-y-8">
            {/* Section Header */}
            <div className="flex items-start gap-3 pb-4 border-b">
                <div className="p-2 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Review Konfigurasi</h3>
                    <p className="text-sm text-gray-500">Periksa kembali semua konfigurasi sebelum menyimpan</p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Basic Info Review */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <CardTitle className="text-base font-semibold text-gray-900">
                                KONFIGURASI PERIODE BARU
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Nama Periode
                                </p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{values.name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Status
                                </p>
                                <div className="mt-1">
                                    {values.is_active ? (
                                        <Badge className="bg-green-50 text-green-700 border-green-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
                                            Aktif
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5" />
                                            Nonaktif
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Durasi Periode
                            </p>
                            <p className="text-sm font-medium text-gray-900 mt-1">
                                {values.start_date && values.end_date
                                    ? `${formatDate(values.start_date)} — ${formatDate(values.end_date)}`
                                    : '—'}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Phase Dates Review */}
                {hasPhaseDates() && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-500" />
                                <CardTitle className="text-base font-semibold text-gray-900">
                                    TANGGAL FASE
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {values.bidding_start && (
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500">Bidding</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {formatDate(values.bidding_start)} — {formatDate(values.bidding_end)}
                                        </p>
                                        {values.bidding_reminder_at && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Pengingat: {formatDate(values.bidding_reminder_at)}
                                            </p>
                                        )}
                                    </div>
                                )}
                                
                                {values.pdc1_start && (
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500">PDC1</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {formatDate(values.pdc1_start)} — {formatDate(values.pdc1_end)}
                                        </p>
                                        {values.pdc1_reminder_at && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Pengingat: {formatDate(values.pdc1_reminder_at)}
                                            </p>
                                        )}
                                    </div>
                                )}
                                
                                {values.pdc2_start && (
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500">PDC2</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {formatDate(values.pdc2_start)} — {formatDate(values.pdc2_end)}
                                        </p>
                                        {values.pdc2_reminder_at && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Pengingat: {formatDate(values.pdc2_reminder_at)}
                                            </p>
                                        )}
                                    </div>
                                )}
                                
                                {values.expo_date && (
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500">EXPO TA</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {formatDate(values.expo_date)}
                                        </p>
                                        {values.expo_reminder_at && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Pengingat: {formatDate(values.expo_reminder_at)}
                                            </p>
                                        )}
                                    </div>
                                )}
                                
                                {values.ta_start && (
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500">Sidang TA</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {formatDate(values.ta_start)} — {formatDate(values.ta_end)}
                                        </p>
                                        {values.ta_reminder_at && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Pengingat: {formatDate(values.ta_reminder_at)}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Group Config Review */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            <CardTitle className="text-base font-semibold text-gray-900">
                                KONFIGURASI GROUP
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Min. Anggota
                                </p>
                                <p className="text-lg font-semibold text-gray-900 mt-1">
                                    {values.min_group_size} orang
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Max. Anggota
                                </p>
                                <p className="text-lg font-semibold text-gray-900 mt-1">
                                    {values.max_group_size} orang
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Max. Dosen
                                </p>
                                <p className="text-lg font-semibold text-gray-900 mt-1">
                                    {values.max_supervisor_load} group
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Evaluation Configurations Review */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <CardTitle className="text-base font-semibold text-gray-900">
                                KONFIGURASI EVALUASI
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Evaluation Types Summary */}
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                                Tipe Penilaian per Fase
                            </p>
                            
                            {hasAnyEvaluationConfig() ? (
                                evaluationTypes.map((type) => {
                                    const selectedComponents = getSelectedComponents(type.id);
                                    const totalWeight = getConfigTotalWeight(type.id);
                                    const hasConfig = selectedComponents.length > 0;
                                    const isExpanded = expandedPhases.includes(type.id);
                                    
                                    if (!hasConfig) return null;
                                    
                                    return (
                                        <div 
                                            key={type.id}
                                            className="border rounded-lg overflow-hidden"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => togglePhaseExpand(type.id)}
                                                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                    <span className="font-medium text-gray-900">{type.label}</span>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {selectedComponents.length} komponen
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge 
                                                        variant={totalWeight === 100 ? "default" : "secondary"}
                                                        className={totalWeight === 100 ? "bg-green-600" : totalWeight > 100 ? "bg-red-600" : ""}
                                                    >
                                                        {totalWeight}%
                                                    </Badge>
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-4 w-4 text-gray-500" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                                    )}
                                                </div>
                                            </button>
                                            
                                            {isExpanded && (
                                                <div className="p-4 bg-white border-t">
                                                    <div className="space-y-2">
                                                        {selectedComponents.map((component) => (
                                                            <div 
                                                                key={component.id}
                                                                className="flex items-center justify-between p-2 bg-gray-50 rounded"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm font-medium text-blue-600">
                                                                        {component.code}
                                                                    </span>
                                                                    <span className="text-sm text-gray-600">
                                                                        {component.description}
                                                                    </span>
                                                                </div>
                                                                <Badge variant="outline">{component.weight}%</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500">Belum ada konfigurasi evaluasi</p>
                                </div>
                            )}
                        </div>

                        {/* Peer Review Summary */}
                        <div className="pt-4 border-t">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                                Peer Review
                            </p>
                            
                            {peerReviewConfig.enabled && peerReviewConfig.indicators && peerReviewConfig.indicators.some((i: PeerReviewIndicator) => i.selected) ? (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Star className="h-4 w-4 text-amber-500" />
                                            <span className="font-medium text-gray-900">Peer Review Aktif</span>
                                        </div>
                                        <Badge 
                                            variant={peerReviewConfig.totalWeight === 100 ? "default" : "secondary"}
                                            className={peerReviewConfig.totalWeight === 100 ? "bg-green-600" : ""}
                                        >
                                            {peerReviewConfig.totalWeight}%
                                        </Badge>
                                    </div>
                                    <div className="space-y-1">
                                        {peerReviewConfig.indicators
                                            .filter((i: PeerReviewIndicator) => i.selected)
                                            .map((indicator: PeerReviewIndicator) => (
                                                <div key={indicator.id} className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-600">{indicator.name}</span>
                                                    <span className="text-gray-500">{indicator.weight}%</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Star className="h-4 w-4" />
                                    <span>Peer Review tidak diaktifkan</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
