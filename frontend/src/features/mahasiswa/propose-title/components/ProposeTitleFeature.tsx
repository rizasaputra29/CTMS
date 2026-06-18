'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { FieldLabel } from '@/components/ui/field-label';
import { FieldError } from '@/components/ui/field-error';
import { FieldDescription } from '@/components/ui/field-description';
import { FieldSet } from '@/components/ui/field-set';
import { FieldLegend } from '@/components/ui/field-legend';
import { FieldGroup } from '@/components/ui/field-group';
import { FieldContent } from '@/components/ui/field-content';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Send, PenLine, Info, CheckCircle, XCircle, Clock, RotateCcw, Lock, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui/loading';
import { formatDate } from '@/lib/utils';
import type { Bid } from '@/types/bid';
import { proposeTitleSchema, type ProposeTitleFormData } from '@/lib/validations/proposals';
import type { Lecturer, Proposal, GroupInfo, ProposalFlow } from '../types';

const specializations = ['Software', 'Embedded', 'Network', 'Multimedia', 'AI', 'Blockchain'];

export function ProposeTitleFeature() {
    const { user } = useAuth();
    const [lecturers, setLecturers] = useState<Lecturer[]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
    const [bidCount, setBidCount] = useState(0);
    const [activeBids, setActiveBids] = useState<Bid[]>([]);
    const [proposalFlow, setProposalFlow] = useState<ProposalFlow | null>(null);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
        setError: setFormError,
    } = useForm<ProposeTitleFormData>({
        resolver: zodResolver(proposeTitleSchema),
        mode: 'onBlur',
        defaultValues: {
            title: '',
            description: '',
            problem_statement: '',
            scope: '',
            specializations: [],
            proposed_supervisor_id: '',
        },
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [groupRes, lecturerRes, proposalRes, bidsRes] = await Promise.all([
                api.get('/mahasiswa/group'),
                api.get('/mahasiswa/lecturers'),
                api.get('/mahasiswa/my-proposal'),
                api.get('/mahasiswa/bids'),
            ]);

            setGroup(groupRes.data.group);
            setLecturers(lecturerRes.data?.data || []);
            setProposals(proposalRes.data.proposals || []);
            setProposalFlow(proposalRes.data.flow || null);
            
            const allBids = bidsRes.data?.data || [];
            const activeBidsFiltered = allBids.filter((b: Bid) =>
                !b.lecturer_recommendation || b.lecturer_recommendation === 'ACCEPT'
            );
            setBidCount(activeBidsFiltered.length);
            setActiveBids(activeBidsFiltered);
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const hasGroup = !!group;
    const hasTitle = !!group?.title_id;
    const isApproved = group?.status === 'APPROVED';
    const hasActiveBid = activeBids.length > 0 && !group?.is_solo;
    const hasActiveProposalFlag = group?.has_active_proposal === true;
    const isLeader = group?.members?.some(m => m.is_leader && m.student.id === user?.id) ?? false;
    
    const memberCount = group?.members?.length || 0;
    const minGroupSize = 3;
    const hasEnoughMembers = group?.is_solo || memberCount >= minGroupSize;
    
    const canPropose = hasGroup && !hasTitle && !hasActiveBid && !hasActiveProposalFlag && ['READY_FOR_BIDDING', 'FORMING', 'FORMING_SOLO'].includes(group?.status || '') && isLeader && hasEnoughMembers;

    const hasPendingProposal = proposals.some(p => ['PENDING', 'UNDER_REVIEW'].includes(p.supervisor_approval_status));
    const hasApprovedProposal = proposals.some(p => p.supervisor_approval_status === 'APPROVED');
    
    const MAX_TITLES = 3;
    const activeProposalCount = proposals.filter(p => ['PENDING', 'UNDER_REVIEW', 'APPROVED'].includes(p.supervisor_approval_status)).length;
    const totalUsed = bidCount + activeProposalCount;
    const slotsRemaining = MAX_TITLES - totalUsed;
    const limitReached = slotsRemaining <= 0;
    const canCreateProposal = proposalFlow?.can_create_proposal ?? canPropose;

    const flowReasonMap: Record<string, string> = {
        NO_GROUP: 'Anda harus memiliki kelompok terlebih dahulu.',
        LEADER_ONLY: 'Hanya ketua kelompok yang dapat mengajukan proposal.',
        INSUFFICIENT_MEMBERS: 'Jumlah anggota kelompok belum memenuhi batas minimal.',
        TITLE_ALREADY_ASSIGNED: 'Kelompok sudah memiliki judul yang disetujui.',
        PENDING_PROPOSAL_EXISTS: 'Masih ada proposal yang sedang ditinjau.',
        INVALID_GROUP_STATUS: 'Status kelompok saat ini tidak memperbolehkan pengajuan proposal.',
        ACTIVE_BID_EXISTS: 'Masih ada bid aktif, proposal baru tidak diperbolehkan.',
        TITLE_LIMIT_REACHED: 'Maksimal 3 slot judul (bids + proposals) sudah tercapai.',
        NO_ACTIVE_PERIOD: 'Periode aktif tidak ditemukan untuk kelompok ini.',
    };

    const onSubmit = async (data: ProposeTitleFormData) => {
        try {
            if (editingProposal) {
                await api.put('/mahasiswa/my-proposal', {
                    title_id: editingProposal.id,
                    ...data,
                    proposed_supervisor_id: parseInt(data.proposed_supervisor_id),
                });
                toast.success(editingProposal.supervisor_approval_status === 'PENDING' ? 'Proposal updated successfully!' : 'Proposal resubmitted successfully!');
            } else {
                await api.post('/mahasiswa/propose-title', {
                    ...data,
                    proposed_supervisor_id: parseInt(data.proposed_supervisor_id),
                });
                toast.success('Proposal submitted successfully!');
            }
            setShowForm(false);
            setEditingProposal(null);
            reset();
            fetchData();
        } catch (error) {
            if (api.isAxiosError(error)) {
                const message = api.getApiErrorMessage(error, 'Failed to submit proposal');
                setFormError('root', { type: 'manual', message });
                toast.error(message);
            } else {
                setFormError('root', { type: 'manual', message: 'Failed to submit proposal' });
                toast.error('Failed to submit proposal');
            }
        }
    };

    const canEditProposal = (proposal: Proposal): boolean => {
        return ['PENDING', 'REJECTED', 'UNDER_REVIEW'].includes(proposal.supervisor_approval_status) && isLeader;
    };

    const handleEdit = (proposal: Proposal) => {
        setEditingProposal(proposal);
        reset({
            title: proposal.title,
            description: proposal.description,
            problem_statement: proposal.problem_statement || '',
            scope: proposal.scope || '',
            specializations: proposal.specializations || [],
            proposed_supervisor_id: proposal.proposed_supervisor?.id?.toString() || '',
        });
        setShowForm(true);
    };

    const handleCancelProposal = async (proposalId: number) => {
        if (!confirm('Apakah Anda yakin ingin membatalkan proposal ini?')) {
            return;
        }

        try {
            const res = await api.delete(`/mahasiswa/proposal/${proposalId}`);
            const data = res.data?.data ?? res.data;
            toast.success(data?.message || 'Proposal dibatalkan');
            fetchData();
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Gagal membatalkan proposal'));
            } else {
                toast.error('Gagal membatalkan proposal');
            }
        }
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingProposal(null);
        reset();
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PENDING': return <Clock className="h-4 w-4" />;
            case 'UNDER_REVIEW': return <Clock className="h-4 w-4" />;
            case 'APPROVED': return <CheckCircle className="h-4 w-4" />;
            case 'REJECTED': return <XCircle className="h-4 w-4" />;
            default: return null;
        }
    };

    const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
        switch (status) {
            case 'PENDING': return 'secondary';
            case 'UNDER_REVIEW': return 'secondary';
            case 'APPROVED': return 'default';
            case 'REJECTED': return 'destructive';
            default: return 'outline';
        }
    };

    if (loading) return <Loading variant="section" />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Propose Title</h1>
                    <p className="text-muted-foreground">Submit your own capstone title proposal to a supervisor.</p>
                </div>
                <div className="flex items-center gap-3">
                    {hasGroup && isLeader && (
                        <Badge variant={slotsRemaining > 0 ? 'outline' : 'destructive'} className="text-sm px-3 py-1">
                            {totalUsed}/{MAX_TITLES} slots used
                        </Badge>
                    )}
                    {canCreateProposal && !hasPendingProposal && !hasApprovedProposal && !showForm && !limitReached && (
                        <Button onClick={() => { setEditingProposal(null); setShowForm(true); }}>
                            <PenLine className="mr-2 h-4 w-4" /> New Proposal
                        </Button>
                    )}
                </div>
            </div>

            {!canCreateProposal && proposalFlow?.reason && (
                <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Proposal Terkunci</AlertTitle>
                    <AlertDescription>
                        {flowReasonMap[proposalFlow.reason] || 'Pengajuan proposal tidak tersedia untuk kondisi kelompok saat ini.'}
                    </AlertDescription>
                </Alert>
            )}

            {hasGroup && !isLeader && (
                <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Leader Only</AlertTitle>
                    <AlertDescription>
                        Only the group leader can propose titles. Contact your group leader to submit proposals.
                    </AlertDescription>
                </Alert>
            )}

            {isLeader && limitReached && !hasApprovedProposal && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Limit Reached</AlertTitle>
                    <AlertDescription>
                        You have used all 3 title slots (bids + proposals combined). Delete an existing bid to make room.
                    </AlertDescription>
                </Alert>
            )}

            {!hasGroup && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Group</AlertTitle>
                    <AlertDescription>
                        You must <a href="/mahasiswa/group" className="font-medium underline">create a group</a> first before proposing a title.
                    </AlertDescription>
                </Alert>
            )}

            {hasGroup && isLeader && !group?.is_solo && memberCount < minGroupSize && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Anggota Kelompok Kurang</AlertTitle>
                    <AlertDescription>
                        Kelompok harus memiliki minimal {minGroupSize} anggota untuk mengajukan judul. 
                        Saat ini kelompok Anda memiliki {memberCount} anggota. 
                        Tambahkan anggota di <Link href="/mahasiswa/group" className="underline font-semibold">My Group</Link>.
                    </AlertDescription>
                </Alert>
            )}

            {isApproved && (
                <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Title Already Approved</AlertTitle>
                    <AlertDescription>
                        Your group already has an approved title: <strong>{group?.title?.title}</strong>. Proposing is locked.
                    </AlertDescription>
                </Alert>
            )}

            {hasActiveBid && (
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Bid Aktif</AlertTitle>
                    <AlertDescription>
                        Kelompok Anda memiliki bid yang sedang diproses atau diterima. 
                        Tidak dapat mengajukan proposal baru.
                        <Link href="/mahasiswa/bidding" className="underline ml-1">Lihat Bids</Link>
                    </AlertDescription>
                </Alert>
            )}

            {hasPendingProposal && !hasApprovedProposal && (
                <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Proposal Pending Review</AlertTitle>
                    <AlertDescription>
                        Your title proposal is awaiting supervisor review. You cannot submit another until it is resolved.
                    </AlertDescription>
                </Alert>
            )}

            {hasApprovedProposal && (
                <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Proposal Approved!</AlertTitle>
                    <AlertDescription>
                        Your title proposal has been approved. Visit <a href="/mahasiswa/group" className="font-medium underline">My Group</a> to see your finalized project.
                    </AlertDescription>
                </Alert>
            )}

            {/* Root Error */}
            {errors.root && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errors.root.message}</AlertDescription>
                </Alert>
            )}

            {/* Proposal Form */}
            {showForm && (canCreateProposal || (editingProposal && ['PENDING', 'REJECTED', 'UNDER_REVIEW'].includes(editingProposal.supervisor_approval_status))) && (
                <Card>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <CardHeader>
                            <CardTitle>{editingProposal ? (editingProposal.supervisor_approval_status === 'PENDING' ? 'Edit Proposal' : 'Resubmit Proposal') : 'New Title Proposal'}</CardTitle>
                            <CardDescription>
                                {editingProposal 
                                    ? (editingProposal.supervisor_approval_status === 'PENDING' 
                                        ? 'Edit your pending proposal before it is reviewed.' 
                                        : 'Edit your proposal and resubmit for review.')
                                    : 'Fill in the details for your proposed title and select a supervisor.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Controller
                                name="title"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                                        <Input
                                            {...field}
                                            id={field.name}
                                            placeholder="Enter your proposed title"
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="description"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                                        <Textarea
                                            {...field}
                                            id={field.name}
                                            placeholder="Describe your project in detail"
                                            rows={3}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        <FieldDescription>
                                            Provide a clear description of what your project will accomplish.
                                        </FieldDescription>
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="problem_statement"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Problem Statement</FieldLabel>
                                        <Textarea
                                            {...field}
                                            id={field.name}
                                            placeholder="What problem does your project solve?"
                                            rows={3}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        <FieldDescription>
                                            Describe the specific problem or gap that your project addresses.
                                        </FieldDescription>
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="scope"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Scope</FieldLabel>
                                        <Textarea
                                            {...field}
                                            id={field.name}
                                            placeholder="Define the boundaries and scope of your project"
                                            rows={3}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        <FieldDescription>
                                            Define what is included and excluded in your project scope.
                                        </FieldDescription>
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="specializations"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <FieldSet>
                                        <FieldLegend variant="label">Specializations</FieldLegend>
                                        <FieldDescription>Select all specializations that apply to your project.</FieldDescription>
                                        <FieldGroup data-slot="checkbox-group">
                                            {specializations.map((spec) => (
                                                <Field
                                                    key={spec}
                                                    orientation="horizontal"
                                                    data-invalid={fieldState.invalid}
                                                >
                                                    <Checkbox
                                                        id={`spec-${spec}`}
                                                        name={field.name}
                                                        checked={field.value?.includes(spec)}
                                                        onCheckedChange={(checked) => {
                                                            const newValue = checked
                                                                ? [...(field.value || []), spec]
                                                                : field.value?.filter((s) => s !== spec) || [];
                                                            field.onChange(newValue);
                                                        }}
                                                        aria-invalid={fieldState.invalid}
                                                    />
                                                    <FieldLabel htmlFor={`spec-${spec}`} className="font-normal">
                                                        {spec}
                                                    </FieldLabel>
                                                </Field>
                                            ))}
                                        </FieldGroup>
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </FieldSet>
                                )}
                            />

                            <Controller
                                name="proposed_supervisor_id"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldContent>
                                            <FieldLabel htmlFor={field.name}>Supervisor (Dosen Pembimbing)</FieldLabel>
                                            <FieldDescription>
                                                Select a lecturer who will supervise your project.
                                            </FieldDescription>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </FieldContent>
                                        <Select
                                            name={field.name}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger
                                                id={field.name}
                                                aria-invalid={fieldState.invalid}
                                            >
                                                <SelectValue placeholder="Select a supervisor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {lecturers.map((lecturer) => (
                                                    <SelectItem key={lecturer.id} value={lecturer.id.toString()}>
                                                        {lecturer.name} ({lecturer.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                )}
                            />
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={handleCloseForm}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send className="mr-2 h-4 w-4" />}
                                {editingProposal ? (editingProposal.supervisor_approval_status === 'PENDING' ? 'Update Proposal' : 'Resubmit Proposal') : 'Submit Proposal'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            )}

            {/* Proposal History */}
            {proposals.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Proposal History</h2>
                    {proposals.map((proposal) => (
                        <Card key={proposal.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{proposal.title}</CardTitle>
                                        <CardDescription>
                                            Supervisor: {proposal.proposed_supervisor?.name || 'Unknown'}
                                        </CardDescription>
                                    </div>
                                    <Badge variant={getStatusVariant(proposal.supervisor_approval_status)} className="flex items-center gap-1">
                                        {getStatusIcon(proposal.supervisor_approval_status)}
                                        {proposal.supervisor_approval_status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Description</div>
                                    <p className="text-sm">{proposal.description}</p>
                                </div>
                                {proposal.problem_statement && (
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Problem Statement</div>
                                        <p className="text-sm">{proposal.problem_statement}</p>
                                    </div>
                                )}
                                {proposal.scope && (
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Scope</div>
                                        <p className="text-sm">{proposal.scope}</p>
                                    </div>
                                )}
                                {proposal.supervisor_approval_status === 'REJECTED' && proposal.rejection_reason && (
                                    <Alert variant="destructive">
                                        <XCircle className="h-4 w-4" />
                                        <AlertTitle>Rejection Reason</AlertTitle>
                                        <AlertDescription>{proposal.rejection_reason}</AlertDescription>
                                    </Alert>
                                )}
                                <div className="text-xs text-muted-foreground">
                                    Submitted: {formatDate(proposal.created_at)}
                                </div>
                            </CardContent>
                            {proposal.supervisor_approval_status === 'REJECTED' && !hasPendingProposal && canCreateProposal && (
                                <CardFooter className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleCancelProposal(proposal.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Batalkan
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(proposal)}>
                                        <RotateCcw className="mr-2 h-4 w-4" /> Edit & Resubmit
                                    </Button>
                                </CardFooter>
                            )}
                            {proposal.supervisor_approval_status === 'PENDING' && canEditProposal(proposal) && (
                                <CardFooter className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleCancelProposal(proposal.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Batalkan
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(proposal)}>
                                        <PenLine className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                </CardFooter>
                            )}
                            {proposal.supervisor_approval_status === 'UNDER_REVIEW' && canEditProposal(proposal) && (
                                <CardFooter className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleCancelProposal(proposal.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Batalkan
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(proposal)}>
                                        <PenLine className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                </CardFooter>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {proposals.length === 0 && !showForm && canPropose && (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    <PenLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-1">No proposals yet</p>
                    <p className="text-sm">Click &quot;New Proposal&quot; to submit your own capstone title.</p>
                </div>
            )}
        </div>
    );
}
