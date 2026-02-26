'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Loader2, ShieldCheck, Lock, Users, BookOpen, CheckCircle2,
    XCircle, ChevronDown, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import axios from 'axios';

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
}

export default function FinalizationPage() {
    const [titles, setTitles] = useState<TitleWithBids[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [lecturers, setLecturers] = useState<Lecturer[]>([]);
    const [isLocked, setIsLocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [allocateOpen, setAllocateOpen] = useState(false);
    const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
    const [sup1, setSup1] = useState('');
    const [sup2, setSup2] = useState('');
    const [submitting, setSubmitting] = useState(false);

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
            setIsLocked(finRes.data.is_locked || false);
            setLecturers(loadRes.data.data || []);
        } catch (err) {
            console.error('Failed to fetch finalization data', err);
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod]);

    useEffect(() => {
        // Initial fetch handled gracefully by the dependency injection
        if (!selectedPeriod) fetchData();
    }, [fetchData, selectedPeriod]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        fetchData(val);
    };

    const handleLockBidding = async () => {
        if (!confirm('Lock bidding? No more bids can be submitted after locking.')) return;
        try {
            await api.post(`/admin/finalization/lock?period_id=${selectedPeriod}`);
            toast.success('Bidding locked.');
            setIsLocked(true);
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed to lock');
            else toast.error('Failed to lock');
        }
    };

    const handleBatchFinalize = async () => {
        if (!confirm('Run batch finalization? This will automatically allocate ACCEPTED bids based on priority and lock bidding if not already locked.')) return;
        setSubmitting(true);
        try {
            const res = await api.post(`/admin/finalization/finalize-period`, { period_id: Number(selectedPeriod) });
            toast.success(`Batch finalization complete. Assigned ${res.data.assigned_count} groups.`);
            fetchData(selectedPeriod);
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed to sequence');
            else toast.error('Failed to finalize');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAllocate = async () => {
        if (!selectedBid) return;
        setSubmitting(true);
        try {
            await api.post('/admin/finalization/allocate', {
                bid_id: selectedBid.id,
                supervisor_1_id: Number(sup1),
                supervisor_2_id: sup2 ? Number(sup2) : null,
            });
            toast.success('Group allocated successfully!');
            setAllocateOpen(false);
            setSelectedBid(null);
            setSup1('');
            setSup2('');
            fetchData();
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Allocation failed');
            else toast.error('Allocation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const openAllocate = (bid: Bid) => {
        setSelectedBid(bid);
        // Pre-fill with group's proposed supervisors if available
        setAllocateOpen(true);
    };

    const availableLecturers = lecturers.filter(l => !l.is_overloaded);

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
                    <p className="text-muted-foreground">Allocate groups to titles, assign supervisors, and lock bidding.</p>
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
                        <Badge variant="destructive" className="px-3 py-1.5 h-10">
                            <Lock className="mr-1 h-3 w-3" /> Locked
                        </Badge>
                    ) : (
                        <Button variant="outline" size="sm" onClick={handleLockBidding} className="h-10">
                            <Lock className="mr-2 h-4 w-4" /> Lock Bidding
                        </Button>
                    )}

                    <Button variant="default" size="sm" onClick={handleBatchFinalize} disabled={submitting || !selectedPeriod} className="h-10">
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Batch Finalize
                    </Button>
                </div>
            </div>

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
            {titles.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Titles Yet</h2>
                    <p className="text-muted-foreground">Titles will appear here once created.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {titles.map((title) => (
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
                                                            {bid.status === 'PENDING' && title.remaining_quota > 0 && (
                                                                <Button size="sm" onClick={() => openAllocate(bid)}>
                                                                    <CheckCircle2 className="mr-1 h-3 w-3" /> Allocate
                                                                </Button>
                                                            )}
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

            {/* Allocate Dialog */}
            <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Allocate Group</DialogTitle>
                        <DialogDescription>
                            Accept this bid and assign supervisors. This will finalize the group&apos;s title.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedBid && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                <div className="font-medium">Group #{selectedBid.group_id}</div>
                                <div className="text-muted-foreground">
                                    Members: {selectedBid.group.members.map(m => m.student.name).join(', ')}
                                </div>
                            </div>
                            <div>
                                <Label>Supervisor 1 (required)</Label>
                                <Select value={sup1} onValueChange={setSup1}>
                                    <SelectTrigger><SelectValue placeholder="Select supervisor 1..." /></SelectTrigger>
                                    <SelectContent>
                                        {lecturers.map((l, i) => (
                                            <SelectItem key={i} value={l.lecturer.id.toString()} disabled={l.is_overloaded}>
                                                {l.lecturer.name} ({l.current_load}/{l.max_load})
                                                {l.is_overloaded ? ' — FULL' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Supervisor 2 (optional)</Label>
                                <Select value={sup2} onValueChange={setSup2}>
                                    <SelectTrigger><SelectValue placeholder="Select supervisor 2..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {lecturers.filter(l => l.lecturer.id.toString() !== sup1).map((l, i) => (
                                            <SelectItem key={i} value={l.lecturer.id.toString()} disabled={l.is_overloaded}>
                                                {l.lecturer.name} ({l.current_load}/{l.max_load})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAllocateOpen(false)}>Cancel</Button>
                        <Button onClick={handleAllocate} disabled={submitting || !sup1}>
                            {submitting ? 'Allocating...' : 'Confirm Allocation'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
