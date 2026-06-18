'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTitle } from '@/components/ui/alert';
import {
    Loader2, ShieldCheck, Lock, Users, BookOpen, CheckCircle2,
    XCircle, ChevronDown, User, RotateCcw, Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';

interface Bid {
    id: number;
    group_id: number;
    title_id: number;
    priority: number;
    status: string;
    lecturer_recommendation: string | null;
    group: {
        id: number;
        status: string;
        members: { id: number; student: { name: string; email: string }; is_leader: boolean }[];
        supervisor_proposals: { supervisor1: { name: string } | null; supervisor2: { name: string } | null } | null;
    };
}

interface TitleWithBids {
    id: number;
    title: string;
    quota: number;
    current_allocations: number;
    remaining_quota: number;
    lecturer: { id: number; name: string };
    bids: Bid[];
}

interface Lecturer {
    lecturer: { id: number; name: string; email: string };
    current_load: number;
    max_load: number;
    is_overloaded: boolean;
}

interface Period {
    id: number;
    name: string;
    is_active: boolean;
    is_finalized: boolean;
}

interface ReadinessStats {
    total_registered: number;
    total_assigned: number;
    total_unassigned: number;
    total_groups: number;
    total_invalid_groups: number;
    unassigned_students: { id: number, name: string, email: string }[];
    invalid_groups: { id: number, status: string, member_count: number, issues: string[] }[];
}

export default function FinalizationPage() {
    const [titles, setTitles] = useState<TitleWithBids[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [lecturers, setLecturers] = useState<Lecturer[]>([]);
    const [readinessStats, setReadinessStats] = useState<ReadinessStats | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [isFinalized, setIsFinalized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTitles = useMemo(() => {
        if (!searchQuery) return titles;
        const lowerQuery = searchQuery.toLowerCase();
        
        return titles.filter(t => {
            const titleMatch = t.title.toLowerCase().includes(lowerQuery);
            const lecturerMatch = t.lecturer.name.toLowerCase().includes(lowerQuery);
            const bidMatch = t.bids.some(b => 
                b.group.members.some(m => m.student.name.toLowerCase().includes(lowerQuery)) ||
                b.group.id.toString().includes(lowerQuery)
            );
            return titleMatch || lecturerMatch || bidMatch;
        });
    }, [titles, searchQuery]);

    const fetchData = useCallback(async (periodId?: string) => {
        setLoading(true);
        try {
            let currentPeriodId = periodId || selectedPeriod;
            if (!currentPeriodId) {
                const perRes = await api.get('/admin/periods');
                setPeriods(perRes.data || []);
                const active = (perRes.data || []).find((p: Period) => p.is_active);
                if (active) currentPeriodId = active.id.toString();
                setSelectedPeriod(currentPeriodId);
            }

            if (!currentPeriodId) {
                setLoading(false);
                return;
            }

            const [finRes, loadRes] = await Promise.all([
                api.get(`/admin/finalization?period_id=${currentPeriodId}`),
                api.get(`/admin/finalization/dosen-load?period_id=${currentPeriodId}`),
            ]);
            setTitles(finRes.data.data || []);
            setReadinessStats(finRes.data.readiness_stats || null);
            setIsLocked(finRes.data.is_locked || false);
            setLecturers(loadRes.data.data || []);

            // Track finalization status for selected period
            const currentPer = (periods.length > 0 ? periods : (await api.get('/admin/periods')).data || []).find((p: Period) => p.id.toString() === currentPeriodId);
            setIsFinalized(currentPer?.is_finalized || false);
        } catch (err) {
            console.error('Failed to fetch finalization data', err);
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, periods]);

    useEffect(() => {
        // Initial fetch handled gracefully by the dependency injection
        if (!selectedPeriod) fetchData();
    }, [fetchData, selectedPeriod]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        const per = periods.find(p => p.id.toString() === val);
        setIsFinalized(per?.is_finalized || false);
        fetchData(val);
    };

    const handleLockBidding = async () => {
        if (!confirm('Lock bidding? No more bids can be submitted after locking.')) return;
        try {
            await api.post(`/admin/finalization/lock?period_id=${selectedPeriod}`);
            toast.success('Bidding locked.');
            setIsLocked(true);
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(api.getApiErrorMessage(error, 'Failed to lock'));
            else toast.error('Failed to lock');
        }
    };

    const handleUnlockBidding = async () => {
        if (!confirm('Unlock bidding? Students will be able to bid again.')) return;
        try {
            await api.post(`/admin/finalization/unlock?period_id=${selectedPeriod}`);
            toast.success('Bidding unlocked.');
            setIsLocked(false);
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(api.getApiErrorMessage(error, 'Failed to unlock'));
            else toast.error('Failed to unlock');
        }
    };

    const handleBatchFinalize = async () => {
        if (!confirm('Run batch finalization? This will automatically allocate ACCEPTED bids based on priority and lock bidding if not already locked.')) return;
        setSubmitting(true);
        try {
            const res = await api.post(`/admin/finalization/finalize-period`, { period_id: Number(selectedPeriod) });
            toast.success(`Batch finalization complete. Assigned ${res.data.total_allocated} groups. Skipped ${res.data.total_skipped}.`);
            setIsFinalized(true);
            fetchData(selectedPeriod);
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(api.getApiErrorMessage(error, 'Failed to finalize'));
            else toast.error('Failed to finalize');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRunMatchmaker = async () => {
        if (!confirm('Run Auto-Matchmaker? This will automatically group isolated students into incomplete groups and form new groups.')) return;
        setSubmitting(true);
        try {
            const res = await api.post(`/admin/finalization/run-automatchmaker`, { period_id: Number(selectedPeriod) });
            toast.success(`Matchmaker complete! Ghost students processed: ${res.data.stats.ghosts_processed}. Groups filled: ${res.data.stats.groups_filled}. Merged: ${res.data.stats.groups_merged}. Created: ${res.data.stats.blank_groups_created}.`);
            fetchData(selectedPeriod);
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(api.getApiErrorMessage(error, 'Failed to run matchmaker'));
            else toast.error('Failed to run matchmaker');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Finalization Dashboard</h1>
                    <p className="text-muted-foreground">Run admin batch finalization, assign supervisors automatically, and lock bidding.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={selectedPeriod} onValueChange={handlePeriodChange} disabled={loading}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            {periods.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {isLocked ? (
                        <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="px-3 py-1.5 h-10">
                                <Lock className="mr-1 h-3 w-3" /> Locked
                            </Badge>
                            <Button variant="outline" size="sm" onClick={handleUnlockBidding} className="h-10">
                                <RotateCcw className="mr-2 h-4 w-4" /> Unlock
                            </Button>
                        </div>
                    ) : (
                        <Button variant="outline" size="sm" onClick={handleLockBidding} className="h-10">
                            <Lock className="mr-2 h-4 w-4" /> Lock Bidding
                        </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={handleRunMatchmaker} disabled={submitting || !selectedPeriod} className="h-10">
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                        Auto-Matchmaker
                    </Button>

                    <Button variant="default" size="sm" onClick={handleBatchFinalize} disabled={submitting || !selectedPeriod || isFinalized} className="h-10">
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Batch Finalize
                    </Button>

                    {isFinalized ? (
                        <Badge variant="default" className="px-3 py-1.5 h-10 bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Finalized
                        </Badge>
                    ) : null}

                    {isFinalized && (
                        <Button variant="outline" size="sm" onClick={async () => {
                            if (!confirm('Re-open this period for registration? New students will be able to create groups again.')) return;
                            try {
                                await api.post('/admin/finalization/reopen', { period_id: Number(selectedPeriod) });
                                toast.success('Period reopened for registration.');
                                setIsFinalized(false);
                            } catch (error) {
                                if (api.isAxiosError(error)) toast.error(api.getApiErrorMessage(error, 'Failed'));
                                else toast.error('Failed');
                            }
                        }} className="h-10">
                            <RotateCcw className="mr-2 h-4 w-4" /> Re-open
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title, lecturer, student name, or group ID..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Readiness Highlights (Rule Enforcement) */}
            {readinessStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className={readinessStats.total_unassigned > 0 ? 'border-amber-200 bg-amber-50' : ''}>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-semibold">Registered Students</CardDescription>
                            <CardTitle className="text-2xl">{readinessStats.total_registered}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xs text-muted-foreground flex justify-between">
                                <span>Assigned: {readinessStats.total_assigned}</span>
                                <span className={readinessStats.total_unassigned > 0 ? 'text-amber-600 font-bold' : ''}>
                                    Unassigned: {readinessStats.total_unassigned}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={readinessStats.total_invalid_groups > 0 ? 'border-destructive/20 bg-destructive/5' : ''}>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-semibold">Total Groups</CardDescription>
                            <CardTitle className="text-2xl">{readinessStats.total_groups}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xs text-muted-foreground flex justify-between">
                                <span>Ready: {readinessStats.total_groups - readinessStats.total_invalid_groups}</span>
                                <span className={readinessStats.total_invalid_groups > 0 ? 'text-destructive font-bold' : ''}>
                                    Invalid: {readinessStats.total_invalid_groups}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                    
                    {/* Collapsible Issues (if any) */}
                    {(readinessStats.total_unassigned > 0 || readinessStats.total_invalid_groups > 0) && (
                        <Card className="md:col-span-2 border-amber-500/50 bg-amber-50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <AlertTitle className="text-amber-800 flex items-center">
                                        <XCircle className="h-4 w-4 mr-2" /> Issues Blocking Finalization
                                    </AlertTitle>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="max-h-[100px] overflow-y-auto text-xs space-y-1">
                                {readinessStats.unassigned_students.map(s => (
                                    <div key={s.id} className="text-amber-800">• Mahasiswa tanpa kelompok: <strong>{s.name}</strong></div>
                                ))}
                                {readinessStats.invalid_groups.map(g => (
                                    <div key={g.id} className="text-destructive">• Kelompok #{g.id} ({g.status}): {g.issues.join(', ')}</div>
                                ))}
                            </CardContent>
                            <CardFooter className="pt-0 pb-2">
                                <p className="text-[10px] text-amber-700 italic">Run Auto-Matchmaker or manual fix to resolve these.</p>
                            </CardFooter>
                        </Card>
                    )}
                    
                    {readinessStats.total_unassigned === 0 && readinessStats.total_invalid_groups === 0 && !isFinalized && (
                        <Card className="md:col-span-2 border-green-200 bg-green-50">
                            <CardHeader>
                                <CardTitle className="text-sm text-green-700 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" /> Period is Ready
                                </CardTitle>
                                <CardDescription className="text-xs text-green-600">
                                    All registered students are assigned and all groups meet the requirements.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    )}
                </div>
            )}

            {/* Supervisor Load Summary */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" /> Supervisor Load
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {lecturers.slice(0, 8).map((l, i) => (
                            <div key={i} className={`p-3 rounded-lg border text-sm ${l.is_overloaded ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/50'}`}>
                                <div className="font-medium truncate">{l.lecturer.name}</div>
                                <div className="text-muted-foreground">
                                    {l.current_load}/{l.max_load} groups
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Title-centric bid list */}
            {filteredTitles.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Titles Found</h2>
                    <p className="text-muted-foreground">Try adjusting your search query or period filter.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTitles.map((title) => (
                        <Collapsible key={title.id}>
                            <Card>
                                <CollapsibleTrigger className="w-full">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div className="text-left">
                                                <CardTitle className="text-base">{title.title}</CardTitle>
                                                <CardDescription>by {title.lecturer.name}</CardDescription>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge variant={title.remaining_quota > 0 ? 'outline' : 'destructive'}>
                                                    {title.remaining_quota}/{title.quota} slots
                                                </Badge>
                                                <Badge variant="secondary">{title.bids.length} bids</Badge>
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </div>
                                    </CardHeader>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <CardContent className="pt-0">
                                        {title.bids.length === 0 ? (
                                            <p className="text-sm text-muted-foreground py-3">No bids for this title.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {title.bids.map((bid) => (
                                                    <div key={bid.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                                P{bid.priority}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-sm">
                                                                    {bid.group.members.map(m => m.student.name).join(', ')}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    Group #{bid.group_id} · {bid.group.status}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {bid.lecturer_recommendation && (
                                                                <Badge variant={bid.lecturer_recommendation === 'ACCEPT' ? 'default' : 'destructive'}>
                                                                    {bid.lecturer_recommendation}
                                                                </Badge>
                                                            )}
                                                            <Badge variant={bid.status === 'ACCEPTED' ? 'default' : bid.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                                                                {bid.status}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                    ))}
                </div>
            )}

        </div>
    );
}
