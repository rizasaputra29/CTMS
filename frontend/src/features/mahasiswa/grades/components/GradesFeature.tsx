'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loading } from '@/components/ui/loading';
import { GraduationCap, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
    EvaluatorDetail,
    ComponentDetail,
    GradeSection,
    GradeData,
    ApiResponse,
} from '../types';

const COMPONENT_LABELS: Record<string, string> = {
    SEMPRO: 'Seminar Proposal',
    BIMBINGAN_SEMPRO: 'Bimbingan Sempro',
    NILAI_DOSEN: 'Nilai Dosen',
    MILESTONE: 'Milestone',
    EXPO: 'Expo',
    PEER_REVIEW: 'Peer Review',
    BIMBINGAN_TA: 'Bimbingan TA',
    SIDANG_TA: 'Sidang TA',
};

const ROLE_LABELS: Record<string, string> = {
    SUPERVISOR_1: 'Pembimbing 1',
    SUPERVISOR_2: 'Pembimbing 2',
    EXAMINER: 'Penguji',
    STUDENT: 'Rekan',
    UNKNOWN: 'Evaluator',
};

function getLetter(score: number): string {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'E';
}

function gradePalette(score: number) {
    if (score >= 85) return { text: 'text-emerald-700', bg: 'bg-emerald-100', bar: 'bg-emerald-500' };
    if (score >= 70) return { text: 'text-sky-700', bg: 'bg-sky-100', bar: 'bg-sky-500' };
    if (score >= 60) return { text: 'text-amber-700', bg: 'bg-amber-100', bar: 'bg-amber-500' };
    if (score >= 50) return { text: 'text-orange-700', bg: 'bg-orange-100', bar: 'bg-orange-500' };
    return { text: 'text-rose-700', bg: 'bg-rose-100', bar: 'bg-rose-500' };
}

interface ScoreBarProps {
    label: string;
    subtitle: string;
    score: number;
    status: string;
}

function ScoreBar({ label, subtitle, score, status }: ScoreBarProps) {
    const letter = getLetter(score);
    const palette = gradePalette(score);
    const pct = Math.min(100, Math.max(0, score));

    return (
        <div className="group flex items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-muted/30">
            <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold ${palette.bg} ${palette.text}`}
                aria-label={`Letter grade ${letter}`}
            >
                {letter}
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2 min-w-0">
                        <span className="truncate text-sm font-semibold">{label}</span>
                        <span className="hidden sm:inline truncate text-xs text-muted-foreground">
                            {subtitle}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-lg font-bold tabular-nums ${palette.text}`}>
                            {score.toFixed(1)}
                        </span>
                        <Badge variant={status === 'COMPLETE' ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5">
                            {status}
                        </Badge>
                    </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ease-out-quart ${palette.bar}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Nilai Saya</h1>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center">
                <GraduationCap className="mb-5 h-12 w-12 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold">Belum ada nilai</h3>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                    Nilai akan muncul setelah pembimbing dan penguji mengirimkan evaluasi.
                </p>
            </div>
        </div>
    );
}

export function GradesFeature() {
    const [result, setResult] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pdc1');

    useEffect(() => {
        api.get('/mahasiswa/my-grades')
            .then((res) => setResult((res.data?.data ?? res.data) as ApiResponse))
            .catch(() => toast.error('Gagal memuat nilai'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <Loading variant="section" />;

    const grades = result?.grades;
    const periodName = result?.period?.name;
    const hasContent = grades && (grades.pdc1 || grades.pdc2 || grades.ta);

    if (!hasContent) return <EmptyState />;

    const sections: { key: string; section: GradeSection; label: string; subtitle: string }[] = [];

    if (grades!.pdc1) sections.push({ key: 'pdc1', section: grades!.pdc1, label: 'PDC 1', subtitle: 'Seminar & Bimbingan' });
    if (grades!.pdc2) sections.push({ key: 'pdc2', section: grades!.pdc2, label: 'PDC 2', subtitle: 'Expo, Milestone & Peer Review' });
    if (grades!.ta) sections.push({ key: 'ta', section: grades!.ta, label: 'TA', subtitle: 'Bimbingan & Sidang TA' });

    const renderTabContent = (section: GradeSection) => (
        <div className="space-y-4">
            {Object.entries(section.components).map(([type, detail]) => {
                const label = COMPONENT_LABELS[type] || type;
                const hasEvaluators = detail.score !== null && detail.evaluators.length > 0;

                return (
                    <div key={type} className="rounded-lg border px-4 py-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">{label}</h4>
                            <div className="flex items-center gap-2">
                                {detail.score !== null && (
                                    <span className={`text-sm font-semibold tabular-nums ${gradePalette(detail.score).text}`}>
                                        {detail.score.toFixed(1)}
                                    </span>
                                )}
                                <Badge variant={detail.score !== null ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5">
                                    {detail.score !== null ? 'Dinilai' : 'Menunggu'}
                                </Badge>
                            </div>
                        </div>

                        {hasEvaluators && (
                            <div className="mt-3 space-y-1.5">
                                {detail.evaluators.map((e, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="truncate text-sm">{e.name}</span>
                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
                                                {ROLE_LABELS[e.role] || e.role}
                                            </Badge>
                                            {e.component && (
                                                <span className="hidden sm:inline truncate text-[11px] text-muted-foreground">
                                                    {e.component}
                                                </span>
                                            )}
                                        </div>
                                        <span className={`ml-2 text-sm font-semibold tabular-nums shrink-0 ${e.score !== null ? gradePalette(e.score).text : 'text-muted-foreground'}`}>
                                            {e.score != null ? Number(e.score).toFixed(1) : '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!hasEvaluators && (
                            <p className="mt-2 text-xs text-muted-foreground italic">
                                Belum ada evaluasi masuk.
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Nilai Saya</h1>
                {periodName && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{periodName}</p>
                )}
            </div>

            <div className="space-y-2">
                {sections.map(({ key, section, label, subtitle }) => (
                    <ScoreBar
                        key={key}
                        label={label}
                        subtitle={subtitle}
                        score={section.grade}
                        status={section.status}
                    />
                ))}
            </div>

            <Separator />

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    {sections.map(({ key, label }) => (
                        <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
                    ))}
                </TabsList>
                {sections.map(({ key, section }) => (
                    <TabsContent key={key} value={key} className="mt-5">
                        {renderTabContent(section)}
                    </TabsContent>
                ))}
            </Tabs>

            <p className="text-[11px] text-muted-foreground">
                Skala: A &ge; 85 &middot; B 70&ndash;84 &middot; C 60&ndash;69 &middot; D 50&ndash;59 &middot; E &lt; 50
            </p>
        </div>
    );
}
