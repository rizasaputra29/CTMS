'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gavel, Trash2, UserCheck, Lock, AlertTriangle, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Field } from '@/components/ui/field';
import { FieldLabel } from '@/components/ui/field-label';
import { FieldError } from '@/components/ui/field-error';
import { FieldContent } from '@/components/ui/field-content';
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
import { useAuth } from '@/context/AuthContext';
import { createBidSchema, type CreateBidFormData } from '@/lib/validations/bidding';
import { getBidStatusBadgeVariant } from '@/lib/badge-variants';
import {
    Lecturer,
    Title,
    Bid,
    GroupInfo,
    ProposalItem,
    BiddingFlow,
} from '../types';

export function BiddingFeature() {
    const { user } = useAuth();
    const [bids, setBids] = useState<Bid[]>([]);
    const [titles, setTitles] = useState<Title[]>([]);
    const [dosens, setDosens] = useState<Lecturer[]>([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [proposals, setProposals] = useState<ProposalItem[]>([]);
    const [reorderedBids, setReorderedBids] = useState<Bid[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [biddingFlow, setBiddingFlow] = useState<BiddingFlow | null>(null);

    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isSubmitting },
        setError: setFormError,
    } = useForm<CreateBidFormData>({
        resolver: zodResolver(createBidSchema),
        mode: 'onBlur',
        defaultValues: {
            title_id: '',
            proposed_supervisor_1_id: '',
            proposed_supervisor_2_id: '',
        },
    });

    const supervisor1Id = watch('proposed_supervisor_1_id');

    const fetchGroup = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/group');
            const data = res.data?.data ?? res.data;
            setGroup(data?.group ?? null);
        } catch {
            // ignore
        }
    }, []);

    const fetchBids = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/bids');
            const responseData = res.data?.data ?? res.data;
            const fetchedBids = responseData?.bids ?? responseData ?? [];
            setBids(fetchedBids);
            setReorderedBids(fetchedBids);
            setBiddingFlow(res.data?.flow ?? responseData?.flow ?? null);
        } catch (err) {
            console.error('Failed to fetch bids', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchProposals = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/my-proposal');
            const data = res.data?.data ?? res.data;
            const fetchedProposals = data?.proposals ?? [];
            setProposals((fetchedProposals ?? []).filter((p: ProposalItem) =>
                ['PENDING', 'UNDER_REVIEW', 'APPROVED'].includes(p.supervisor_approval_status)
            ));
        } catch (err) {
            console.error('Failed to fetch proposals', err);
        }
    }, []);

    const fetchTitles = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/titles');
            setTitles(res.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch titles', err);
        }
    }, []);

    const fetchDosens = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/lecturers');
            setDosens(res.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch lecturers', err);
        }
    }, []);

    useEffect(() => {
        fetchGroup();
        fetchBids();
        fetchTitles();
        fetchDosens();
        fetchProposals();
    }, [fetchGroup, fetchBids, fetchTitles, fetchDosens, fetchProposals]);

    const isLeader = group?.members.some(m => m.is_leader && m.student.id === user?.id) ?? false;
    const MAX_TITLES = 3;

    const totalUsed = bids.length + proposals.length;
    const slotsRemaining = MAX_TITLES - totalUsed;
    const hasActiveProposal = proposals.length > 0;
    const localCanSubmit = isLeader && slotsRemaining > 0 && !hasActiveProposal;
    const canSubmitBid = biddingFlow?.can_submit_bid ?? localCanSubmit;
    const canReorderBid = biddingFlow?.can_reorder_bid ?? isLeader;
    const canDeleteBid = biddingFlow?.can_delete_bid ?? isLeader;

    const flowReasonMap: Record<string, string> = {
        NO_GROUP: 'Anda harus memiliki kelompok terlebih dahulu.',
        LEADER_ONLY: 'Hanya ketua kelompok yang dapat mengelola bidding.',
        SOLO_GROUP_CANNOT_BID: 'Kelompok solo tidak dapat bidding judul dosen.',
        INSUFFICIENT_MEMBERS: 'Jumlah anggota kelompok belum memenuhi minimal untuk bidding.',
        INVALID_GROUP_STATUS: 'Status kelompok saat ini tidak memungkinkan bidding.',
        ACTIVE_PROPOSAL_EXISTS: 'Kelompok Anda memiliki proposal aktif. Bidding dinonaktifkan.',
        PERIOD_FINALIZED: 'Periode sudah ditutup oleh admin.',
        BIDDING_LOCKED: 'Bidding sudah dikunci.',
        BIDDING_WINDOW_CLOSED: 'Jendela waktu bidding belum dibuka atau sudah berakhir.',
        TITLE_LIMIT_REACHED: 'Maksimal 3 slot judul (bidding + proposal) sudah tercapai.',
    };

    const movePriority = (bidId: number, direction: 'up' | 'down') => {
        setReorderedBids(prev => {
            const newBids = [...prev].sort((a, b) => a.priority - b.priority);
            const index = newBids.findIndex(b => b.id === bidId);
            if (index === -1) return prev;

            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= newBids.length) return prev;

            const currentBid = newBids[index];
            const targetBid = newBids[targetIndex];

            const currentPriority = currentBid.priority;
            const targetPriority = targetBid.priority;

            newBids[index] = { ...currentBid, priority: targetPriority };
            newBids[targetIndex] = { ...targetBid, priority: currentPriority };

            setHasChanges(true);
            return newBids;
        });
    };

    const savePriorityOrder = async () => {
        try {
            const orderData = reorderedBids.map(b => ({ id: b.id, priority: b.priority }));
            await api.put('/mahasiswa/bids/reorder', { bids: orderData });
            setBids(reorderedBids);
            setHasChanges(false);
            toast.success('Urutan prioritas berhasil disimpan');
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Gagal menyimpan urutan'));
            } else {
                toast.error('Gagal menyimpan urutan');
            }
        }
    };

    const onSubmit = async (data: CreateBidFormData) => {
        try {
            await api.post('/mahasiswa/bids', {
                title_id: Number(data.title_id),
                proposed_supervisor_1_id: Number(data.proposed_supervisor_1_id),
                proposed_supervisor_2_id: data.proposed_supervisor_2_id ? Number(data.proposed_supervisor_2_id) : null,
            });
            toast.success('Bid submitted successfully!');
            setAddOpen(false);
            reset();
            fetchBids();
        } catch (error) {
            if (api.isAxiosError(error)) {
                const message = api.getApiErrorMessage(error, 'Failed to submit bid');
                setFormError('root', { type: 'manual', message });
                toast.error(message);
            } else {
                setFormError('root', { type: 'manual', message: 'Failed to submit bid' });
                toast.error('Failed to submit bid');
            }
        }
    };

    const handleDeleteBid = async (bidId: number) => {
        if (!confirm('Are you sure you want to delete this bid?')) return;
        try {
            await api.delete(`/mahasiswa/bids/${bidId}`);
            toast.success('Bid deleted.');
            fetchBids();
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Failed to delete bid'));
            } else {
                toast.error('Failed to delete bid');
            }
        }
    };

    const handleOpenDialog = () => {
        reset();
        setAddOpen(true);
    };

    const handleCloseDialog = () => {
        setAddOpen(false);
        reset();
    };

    const getStatusVariant = (status: string) => getBidStatusBadgeVariant(status);

    if (loading) return <Loading variant="section" />;

    const bidTitleIds = bids.map(b => b.title_id);
    const availableTitles = titles.filter(t => !bidTitleIds.includes(t.id));
    const availableSup2 = dosens.filter(d => d.id.toString() !== supervisor1Id);

    if (!isLeader) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Title Bidding</h1>
                    <p className="text-muted-foreground">Submit and manage your title bids.</p>
                </div>
                {!group ? (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>No Group</AlertTitle>
                        <AlertDescription>
                            You need to join or create a group first before bidding on titles.
                        </AlertDescription>
                    </Alert>
                ) : !isLeader ? (
                    <Alert>
                        <Lock className="h-4 w-4" />
                        <AlertTitle>Leader Only</AlertTitle>
                        <AlertDescription>
                            Only the group leader can submit and manage title bids. Contact your group leader for bidding.
                        </AlertDescription>
                    </Alert>
                ) : null}
                {(bids ?? []).length > 0 && (
                    <div className="grid gap-4">
                        <h2 className="text-lg font-semibold">Current Bids</h2>
                        {(bids ?? []).sort((a, b) => a.priority - b.priority).map((bid) => (
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
                    <p className="text-muted-foreground">Kelola ranking judul TA Anda. Gunakan panah untuk mengubah urutan prioritas.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={slotsRemaining > 0 ? 'outline' : 'destructive'} className="text-sm px-3 py-1">
                        {totalUsed}/{MAX_TITLES} slots used
                    </Badge>
                    <Button
                        onClick={handleOpenDialog}
                        disabled={!canSubmitBid || availableTitles.length === 0}
                        variant={canSubmitBid ? 'default' : 'outline'}
                    >
                        Submit Bid
                    </Button>
                    {hasChanges && (
                        <Button onClick={savePriorityOrder} disabled={!canReorderBid}>
                            <Save className="mr-2 h-4 w-4" /> Simpan Urutan
                        </Button>
                    )}
                </div>
            </div>

            {!canSubmitBid && biddingFlow?.reason && (
                <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Bidding Terkunci</AlertTitle>
                    <AlertDescription>
                        {flowReasonMap[biddingFlow.reason] || 'Bidding tidak tersedia untuk kondisi kelompok saat ini.'}
                    </AlertDescription>
                </Alert>
            )}

            {errors.root && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errors.root.message}</AlertDescription>
                </Alert>
            )}

            {slotsRemaining <= 0 && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Limit Reached</AlertTitle>
                    <AlertDescription>
                        You have used all 3 title slots (bids + proposals combined). Delete an existing bid to make room for a new one.
                    </AlertDescription>
                </Alert>
            )}

            {hasActiveProposal && (
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Proposal Aktif</AlertTitle>
                    <AlertDescription>
                        Kelompok Anda memiliki proposal yang sedang diproses. Tidak dapat mengajukan bid baru.
                        <Link href="/mahasiswa/propose-title" className="underline ml-1">Lihat Proposal</Link>
                    </AlertDescription>
                </Alert>
            )}

            {bids.length === 0 && proposals.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Bids Yet</h2>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                        Submit a bid to express your interest in a title. You can rank multiple titles by priority.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {(proposals ?? []).length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800">Proposal</Badge>
                                Judul yang Anda Usulkan
                            </h2>
                            <div className="grid gap-4">
                                {(proposals ?? []).map((proposal) => (
                                    <Card key={proposal.id} className="relative border-l-4 border-l-blue-500">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <CardTitle className="text-base">{proposal.title}</CardTitle>
                                                    <CardDescription>Proposed Supervisor: {proposal.proposed_supervisor?.name || '-'}</CardDescription>
                                                </div>
                                                <Badge variant={getStatusVariant(proposal.supervisor_approval_status)}>
                                                    {proposal.supervisor_approval_status}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pb-3">
                                            <p className="text-sm text-muted-foreground line-clamp-2">{proposal.description}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {(bids ?? []).length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <Badge variant="default" className="bg-green-100 text-green-800">Bid</Badge>
                                Judul yang Anda Bidding
                            </h2>
                            <div className="grid gap-4">
                                {(reorderedBids ?? []).sort((a, b) => a.priority - b.priority).map((bid, index) => {
                                    const isAccepted = bid.lecturer_recommendation === 'ACCEPT';

                                    return (
                                    <Card key={bid.id} className={`relative ${isAccepted ? 'border-green-300 bg-green-50/30' : ''}`}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() => movePriority(bid.id, 'up')}
                                                            disabled={index === 0 || !canReorderBid}
                                                        >
                                                            <ArrowUp className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() => movePriority(bid.id, 'down')}
                                                            disabled={index === reorderedBids.length - 1 || !canReorderBid}
                                                        >
                                                            <ArrowDown className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg ${isAccepted ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700'}`}>
                                                        {bid.priority}
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base">{bid.title.title}</CardTitle>
                                                        <CardDescription>Lecturer: {bid.title.lecturer?.name}</CardDescription>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={getStatusVariant(bid.status)}>{bid.status}</Badge>
                                                    {isAccepted && (
                                                        <Badge variant="default">DITERIMA</Badge>
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
                                                {bid.status === 'PENDING' && canDeleteBid && (
                                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteBid(bid.id)}>
                                                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </CardFooter>
                                    </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* New Bid Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Submit a New Bid</DialogTitle>
                            <DialogDescription>
                                Select a title and propose supervisors (Pembimbing 1 required, Pembimbing 2 optional).
                                <br />
                                <span className="font-medium">{slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} remaining</span> (max {MAX_TITLES} bids + proposals combined).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {errors.root && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{errors.root.message}</AlertDescription>
                                </Alert>
                            )}

                            <Controller
                                name="title_id"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Title <span className="text-destructive">*</span></FieldLabel>
                                        <Select
                                            name={field.name}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                                                <SelectValue placeholder="Select a title..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(availableTitles ?? []).map(t => (
                                                    <SelectItem key={t.id} value={t.id.toString()}>
                                                        {t.title} — {t.lecturer?.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            <Field>
                                <FieldLabel>Priority</FieldLabel>
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                    <Badge variant="outline" className="bg-background">Auto</Badge>
                                    <span className="font-semibold text-lg">#{(bids ?? []).length + 1}</span>
                                    <span className="text-sm text-muted-foreground">
                                        (akan menjadi prioritas ke-{(bids ?? []).length + 1})
                                    </span>
                                </div>
                            </Field>

                            <Controller
                                name="proposed_supervisor_1_id"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>
                                            Proposed Pembimbing 1 <span className="text-destructive">*</span>
                                        </FieldLabel>
                                        <Select
                                            name={field.name}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                                                <SelectValue placeholder="Select supervisor..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {dosens.map(d => (
                                                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="proposed_supervisor_2_id"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldContent>
                                            <FieldLabel htmlFor={field.name}>
                                                Proposed Pembimbing 2 <span className="text-muted-foreground text-xs">(optional)</span>
                                            </FieldLabel>
                                        </FieldContent>
                                        <Select
                                            name={field.name}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                                                <SelectValue placeholder="Select supervisor (optional)..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="">— None —</SelectItem>
                                                {availableSup2.map(d => (
                                                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Submitting...' : 'Submit Bid'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
