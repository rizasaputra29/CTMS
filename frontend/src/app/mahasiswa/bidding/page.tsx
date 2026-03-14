'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gavel, Plus, Trash2, UserCheck, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

interface Lecturer {
    id: number;
    name: string;
}

interface Title {
    id: number;
    title: string;
    description: string;
    quota: number;
    lecturer: Lecturer;
}

interface Bid {
    id: number;
    title_id: number;
    priority: number;
    status: string;
    lecturer_recommendation: string | null;
    proposed_supervisor_1_id: number | null;
    proposed_supervisor_2_id: number | null;
    proposed_supervisor1: Lecturer | null;
    proposed_supervisor2: Lecturer | null;
    title: Title;
}

interface GroupInfo {
    id: number;
    members: { id: number; student: { id: number }; is_leader: boolean }[];
}

export default function BiddingPage() {
    const { user } = useAuth();
    const [bids, setBids] = useState<Bid[]>([]);
    const [titles, setTitles] = useState<Title[]>([]);
    const [dosens, setDosens] = useState<Lecturer[]>([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);
    const [selectedTitle, setSelectedTitle] = useState('');
    const [priority, setPriority] = useState('');
    const [supervisor1, setSupervisor1] = useState('');
    const [supervisor2, setSupervisor2] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [proposalCount, setProposalCount] = useState(0);

    const fetchGroup = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/group');
            setGroup(res.data.group);
        } catch {
            // ignore
        }
    }, []);

    const fetchProposalCount = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/my-proposal');
            const proposals = res.data.proposals || [];
            const activeProposals = proposals.filter(
                (p: { supervisor_approval_status: string }) =>
                    p.supervisor_approval_status === 'PENDING' || p.supervisor_approval_status === 'APPROVED'
            );
            setProposalCount(activeProposals.length);
        } catch {
            // ignore
        }
    }, []);

    const fetchBids = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/bids');
            setBids(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch bids', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTitles = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/titles');
            setTitles(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch titles', err);
        }
    }, []);

    const fetchDosens = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/lecturers');
            setDosens(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch lecturers', err);
        }
    }, []);

    useEffect(() => {
        fetchGroup();
        fetchBids();
        fetchTitles();
        fetchDosens();
        fetchProposalCount();
    }, [fetchGroup, fetchBids, fetchTitles, fetchDosens, fetchProposalCount]);

    const isLeader = group?.members.some(m => m.is_leader && m.student.id === user?.id) ?? false;
    const MAX_TITLES = 3;
    const totalUsed = bids.length + proposalCount;
    const slotsRemaining = MAX_TITLES - totalUsed;

    const handleSubmitBid = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supervisor1) {
            toast.error('Proposed Supervisor 1 is required.');
            return;
        }
        setSubmitting(true);
        try {
            await api.post('/mahasiswa/bids', {
                title_id: Number(selectedTitle),
                priority: Number(priority),
                proposed_supervisor_1_id: Number(supervisor1),
                proposed_supervisor_2_id: supervisor2 ? Number(supervisor2) : null,
            });
            toast.success('Bid submitted successfully!');
            setAddOpen(false);
            setSelectedTitle('');
            setPriority('');
            setSupervisor1('');
            setSupervisor2('');
            fetchBids();
            fetchProposalCount();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to submit bid');
            } else {
                toast.error('Failed to submit bid');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteBid = async (bidId: number) => {
        if (!confirm('Are you sure you want to delete this bid?')) return;
        try {
            await api.delete(`/mahasiswa/bids/${bidId}`);
            toast.success('Bid deleted.');
            fetchBids();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to delete bid');
            } else {
                toast.error('Failed to delete bid');
            }
        }
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'ACCEPTED': return 'default' as const;
            case 'REJECTED': return 'destructive' as const;
            default: return 'secondary' as const;
        }
    };

    const getRecVariant = (rec: string | null) => {
        if (rec === 'ACCEPT') return 'default' as const;
        if (rec === 'REJECT') return 'destructive' as const;
        return 'outline' as const;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const bidTitleIds = bids.map(b => b.title_id);
    const availableTitles = titles.filter(t => !bidTitleIds.includes(t.id));
    const usedPriorities = bids.map(b => b.priority);
    const availableSup2 = dosens.filter(d => d.id.toString() !== supervisor1);

    // Non-leader: show access denied
    if (!isLeader) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Title Bidding</h1>
                    <p className="text-muted-foreground">Submit and manage your title bids.</p>
                </div>
                <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Leader Only</AlertTitle>
                    <AlertDescription>
                        Only the group leader can submit and manage title bids. Contact your group leader for bidding.
                    </AlertDescription>
                </Alert>
                {/* Still show existing bids as read-only */}
                {bids.length > 0 && (
                    <div className="grid gap-4">
                        <h2 className="text-lg font-semibold">Current Bids</h2>
                        {bids.sort((a, b) => a.priority - b.priority).map((bid) => (
                            <Card key={bid.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                                {bid.priority}
                                            </div>
                                            <div>
                                                <CardTitle className="text-base">{bid.title.title}</CardTitle>
                                                <CardDescription>Lecturer: {bid.title.lecturer?.name}</CardDescription>
                                            </div>
                                        </div>
                                        <Badge variant={getStatusVariant(bid.status)}>{bid.status}</Badge>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Title Bidding</h1>
                    <p className="text-muted-foreground">Submit and manage your title bids. Ranked by priority (1 = highest).</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={slotsRemaining > 0 ? 'outline' : 'destructive'} className="text-sm px-3 py-1">
                        {totalUsed}/{MAX_TITLES} slots used
                    </Badge>
                    {slotsRemaining > 0 && (
                        <Button onClick={() => setAddOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New Bid
                        </Button>
                    )}
                </div>
            </div>

            {slotsRemaining <= 0 && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Limit Reached</AlertTitle>
                    <AlertDescription>
                        You have used all 3 title slots (bids + proposals combined). Delete an existing bid to make room for a new one.
                    </AlertDescription>
                </Alert>
            )}

            {bids.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Bids Yet</h2>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                        Submit a bid to express your interest in a title. You can rank multiple titles by priority.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {bids.sort((a, b) => a.priority - b.priority).map((bid) => (
                        <Card key={bid.id} className="relative">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                            {bid.priority}
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{bid.title.title}</CardTitle>
                                            <CardDescription>Lecturer: {bid.title.lecturer?.name}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={getStatusVariant(bid.status)}>{bid.status}</Badge>
                                        {bid.lecturer_recommendation && (
                                            <Badge variant={getRecVariant(bid.lecturer_recommendation)}>
                                                Rec: {bid.lecturer_recommendation}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <UserCheck className="h-4 w-4" />
                                        <span>Pembimbing 1: <span className="font-medium text-foreground">{bid.proposed_supervisor1?.name || '-'}</span></span>
                                    </div>
                                    {bid.proposed_supervisor2 && (
                                        <div className="flex items-center gap-1">
                                            <UserCheck className="h-4 w-4" />
                                            <span>Pembimbing 2: <span className="font-medium text-foreground">{bid.proposed_supervisor2.name}</span></span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="border-t pt-3">
                                <div className="flex justify-between w-full items-center">
                                    <span className="text-sm text-muted-foreground">Priority #{bid.priority}</span>
                                    {bid.status === 'PENDING' && (
                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteBid(bid.id)}>
                                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                                        </Button>
                                    )}
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* New Bid Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <form onSubmit={handleSubmitBid}>
                        <DialogHeader>
                            <DialogTitle>Submit a New Bid</DialogTitle>
                            <DialogDescription>
                                Select a title, assign priority, and propose supervisors (Pembimbing 1 required, Pembimbing 2 optional).
                                <br />
                                <span className="font-medium">{slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} remaining</span> (max {MAX_TITLES} bids + proposals combined).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="title">Title</Label>
                                <Select value={selectedTitle} onValueChange={setSelectedTitle}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a title..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableTitles.map(t => (
                                            <SelectItem key={t.id} value={t.id.toString()}>
                                                {t.title} — {t.lecturer.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="priority">Priority</Label>
                                <Input
                                    id="priority"
                                    type="number"
                                    min={1}
                                    placeholder="1 (highest priority)"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    required
                                />
                                {usedPriorities.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Already used: {usedPriorities.sort((a, b) => a - b).join(', ')}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label>Proposed Pembimbing 1 <span className="text-destructive">*</span></Label>
                                <Select value={supervisor1} onValueChange={setSupervisor1}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select supervisor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dosens.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Proposed Pembimbing 2 <span className="text-muted-foreground text-xs">(optional)</span></Label>
                                <Select value={supervisor2} onValueChange={setSupervisor2}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select supervisor (optional)..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— None —</SelectItem>
                                        {availableSup2.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={submitting || !selectedTitle || !priority || !supervisor1}>
                                {submitting ? 'Submitting...' : 'Submit Bid'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
