'use client';

import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Circle, Lock } from 'lucide-react';
import type { WorkflowPhase } from '@/types/dashboard';

const PHASE_ORDER = ['PDC1', 'SEMPRO', 'PDC2', 'TA_DRAFT', 'EXPO', 'TA'] as const;

const PHASE_LABELS: Record<string, string> = {
    PDC1: 'PDC 1',
    SEMPRO: 'Seminar Proposal',
    PDC2: 'PDC 2',
    TA_DRAFT: 'TA Draft',
    EXPO: 'Expo',
    TA: 'Sidang TA',
};

const STATUS_LABELS: Record<string, string> = {
    completed: 'Selesai',
    submitted: 'Terkirim',
    draft: 'Draft',
    revision: 'Revisi',
    unlocked: 'Terbuka',
    locked: 'Terkunci',
};

interface StatusGroupProps {
    phases?: WorkflowPhase[];
    currentPhase?: string | null;
    periodName?: string;
}

export function StatusGroup({ phases = [], currentPhase = null, periodName = '' }: StatusGroupProps) {
    const phaseMap = new Map((phases ?? []).map((p) => [p.phase, p]));

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-800">Status Group</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                    Periode <span className="font-medium text-gray-600">{periodName}</span>
                </p>
            </div>

            <div className="flex items-center justify-between gap-2">
                {PHASE_ORDER.map((phaseKey, index) => {
                    const phase = phaseMap.get(phaseKey);
                    const status = phase?.status || 'locked';
                    const isCompleted = status === 'completed';
                    const isLocked = status === 'locked';
                    const isActive = phaseKey === currentPhase;

                    return (
                        <TooltipProvider key={phaseKey} delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex flex-col items-center gap-2 flex-1 cursor-pointer">
                                        <div
                                            className={cn(
                                                'w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-all',
                                                isCompleted && 'bg-emerald-50 border-emerald-500 text-emerald-600',
                                                isLocked && 'bg-gray-100 border-gray-200 text-gray-400',
                                                !isCompleted && !isLocked && 'bg-white border-primary-500 text-primary-500',
                                                isActive && 'ring-2 ring-primary-500/30',
                                            )}
                                        >
                                            {isCompleted ? (
                                                <Check className="h-5 w-5" strokeWidth={3} />
                                            ) : isLocked ? (
                                                <Lock className="h-4 w-4" />
                                            ) : (
                                                <Circle className="h-5 w-5" />
                                            )}
                                        </div>
                                        <span
                                            className={cn(
                                                'text-xs font-medium text-center leading-tight',
                                                isCompleted && 'text-emerald-700',
                                                isLocked && 'text-gray-400',
                                                !isCompleted && !isLocked && 'text-gray-700',
                                            )}
                                        >
                                            {PHASE_LABELS[phaseKey] || phaseKey}
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                    <p className="font-medium">{PHASE_LABELS[phaseKey] || phaseKey}</p>
                                    <p className="text-muted-foreground">
                                        {STATUS_LABELS[status] || status}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                })}
            </div>
        </div>
    );
}
