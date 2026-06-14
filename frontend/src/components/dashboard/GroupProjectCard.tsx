'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { FileText, Users } from 'lucide-react';
import type { Group } from '@/types/group';
import type { WorkflowData } from '@/types/dashboard';

const PHASE_BADGE_MAP: Record<string, { label: string; color: string }> = {
    PDC1: { label: 'PDC 1', color: 'bg-sky-100 text-sky-700 border-sky-200' },
    SEMPRO: { label: 'Sempro', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    PDC2: { label: 'PDC 2', color: 'bg-primary-50 text-primary-700 border-primary-200' },
    TA_DRAFT: { label: 'TA Draft', color: 'bg-violet-50 text-violet-700 border-violet-200' },
    EXPO: { label: 'Expo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    TA: { label: 'Sidang TA', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

interface GroupProjectCardProps {
    group: Group;
    workflow: WorkflowData | null;
    title?: string | null;
}

export function GroupProjectCard({ group, workflow, title }: GroupProjectCardProps) {
    const groupTitle = title || group.title?.title || 'Belum ada judul';
    const periodName = group.period?.name || '';
    const groupCode = `${periodName}K${group.id}`;
    const currentPhase = workflow?.current_phase;

    // Calculate progress
    const phases = workflow?.phases || [];
    const totalPhases = phases.length;
    const completedPhases = phases.filter((p) => p.status === 'completed').length;
    const progressPercent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

    const badgeInfo = currentPhase ? PHASE_BADGE_MAP[currentPhase] : null;

    return (
        <Card className="h-full">
            <CardContent className="p-5 space-y-4">
                {/* Badge fase */}
                {badgeInfo && (
                    <Badge
                        variant="outline"
                        className={cn(
                            'text-xs font-medium h-6 px-2.5',
                            badgeInfo.color,
                        )}
                    >
                        {badgeInfo.label}
                    </Badge>
                )}

                {/* Title */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 leading-snug line-clamp-2">
                        {groupTitle}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1 font-mono">{groupCode}</p>
                </div>

                {/* Progress */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium text-gray-700">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                </div>

                {/* Members */}
                <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-gray-400" />
                    <div className="flex -space-x-2">
                        {group.members.slice(0, 4).map((member) => (
                            <Avatar
                                key={member.id}
                                className="h-7 w-7 border-2 border-white text-xs"
                            >
                                <AvatarFallback className="bg-primary-100 text-primary-700 text-[10px]">
                                    {member.student.name
                                        .split(' ')
                                        .map((n) => n[0])
                                        .join('')
                                        .slice(0, 2)
                                        .toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        ))}
                        {group.members.length > 4 && (
                            <div className="h-7 w-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] text-gray-500 font-medium">
                                +{group.members.length - 4}
                            </div>
                        )}
                    </div>
                    <span className="text-xs text-gray-400">{group.members.length} anggota</span>
                </div>

                <Separator />

                {/* Supervisors */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        {group.supervisor1 && (
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6 text-[10px]">
                                    <AvatarFallback className="bg-gray-100 text-gray-600">
                                        {group.supervisor1.name
                                            .split(' ')
                                            .map((n) => n[0])
                                            .join('')
                                            .slice(0, 2)
                                            .toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-gray-600">{group.supervisor1.name}</span>
                            </div>
                        )}
                        {group.supervisor2 && (
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6 text-[10px]">
                                    <AvatarFallback className="bg-gray-100 text-gray-600">
                                        {group.supervisor2.name
                                            .split(' ')
                                            .map((n) => n[0])
                                            .join('')
                                            .slice(0, 2)
                                            .toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-gray-600">{group.supervisor2.name}</span>
                            </div>
                        )}
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5 bg-gray-100 text-gray-500">
                        Dosen Pembimbing
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}
