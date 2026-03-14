'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, PenLine, Info, CheckCircle, XCircle, Clock, RotateCcw, Lock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface Lecturer {
    id: number;
    name: string;
    email: string;
}

interface Proposal {
    id: number;
    title: string;
    description: string;
    problem_statement: string;
    scope: string;
    specializations: string[] | null;
    supervisor_approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
    rejection_reason: string | null;
    proposed_supervisor: {
        id: number;
        name: string;
        email: string;
    } | null;
    created_at: string;
    updated_at: string;
}

interface GroupInfo {
    id: number;
    status: string;
    title_id: number | null;
    title: { title: string } | null;
    members: { id: number; student: { id: number }; is_leader: boolean }[];
}

export default function ProposeTitlePage() {
    const { user } = useAuth();
    const [lecturers, setLecturers] = useState<Lecturer[]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
    const [bidCount, setBidCount] = useState(0);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        problem_statement: '',
        scope: '',
        specializations: [] as string[],
        proposed_supervisor_id: '',
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
            setLecturers(lecturerRes.data.data);
            setProposals(proposalRes.data.proposals || []);
            setBidCount((bidsRes.data.data || []).length);
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
    const isPending = group?.status === 'PENDING';
    const isWaitingProposal = group?.status === 'WAITING_SUPERVISOR_APPROVAL';
    const isLeader = group?.members?.some(m => m.is_leader && m.student.id === user?.id) ?? false;
    const canPropose = hasGroup && !hasTitle && !isPending && !isWaitingProposal && group?.status === 'READY_FOR_BIDDING' && isLeader;

    const hasPendingProposal = proposals.some(p => p.supervisor_approval_status === 'PENDING');
    const hasApprovedProposal = proposals.some(p => p.supervisor_approval_status === 'APPROVED');

    const MAX_TITLES = 3;
    const activeProposalCount = proposals.filter(p => p.supervisor_approval_status === 'PENDING' || p.supervisor_approval_status === 'APPROVED').length;
    const totalUsed = bidCount + activeProposalCount;
    const slotsRemaining = MAX_TITLES - totalUsed;
    const limitReached = slotsRemaining <= 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingProposal) {
                await api.put('/mahasiswa/my-proposal', {
                    title_id: editingProposal.id,
                    ...formData,
                    proposed_supervisor_id: parseInt(formData.proposed_supervisor_id),
                });
                toast.success('Proposal resubmitted successfully!');
            } else {
                await api.post('/mahasiswa/propose-title', {
                    ...formData,
                    proposed_supervisor_id: parseInt(formData.proposed_supervisor_id),
                });
                toast.success('Proposal submitted successfully!');
            }
            setShowForm(false);
            setEditingProposal(null);
            setFormData({ title: '', description: '', problem_statement: '', scope: '', specializations: [], proposed_supervisor_id: '' });
            fetchData();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to submit proposal');
            } else {
                toast.error('Failed to submit proposal');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleResubmit = (proposal: Proposal) => {
        setEditingProposal(proposal);
        setFormData({
            title: proposal.title,
            description: proposal.description,
            problem_statement: proposal.problem_statement || '',
            scope: proposal.scope || '',
            specializations: proposal.specializations || [],
            proposed_supervisor_id: proposal.proposed_supervisor?.id?.toString() || '',
        });
        setShowForm(true);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PENDING': return <Clock className="h-4 w-4" />;
            case 'APPROVED': return <CheckCircle className="h-4 w-4" />;
            case 'REJECTED': return <XCircle className="h-4 w-4" />;
            default: return null;
        }
    };

    const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
        switch (status) {
            case 'PENDING': return 'secondary';
            case 'APPROVED': return 'default';
            case 'REJECTED': return 'destructive';
            default: return 'outline';
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
                    {canPropose && !hasPendingProposal && !hasApprovedProposal && !showForm && !limitReached && (
                        <Button onClick={() => { setEditingProposal(null); setShowForm(true); }}>
                            <PenLine className="mr-2 h-4 w-4" /> New Proposal
                        </Button>
                    )}
                </div>
            </div>

            {/* Leader-only guard */}
            {hasGroup && !isLeader && (
                <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Leader Only</AlertTitle>
                    <AlertDescription>
                        Only the group leader can propose titles. Contact your group leader to submit proposals.
                    </AlertDescription>
                </Alert>
            )}

            {/* Limit reached */}
            {isLeader && limitReached && !hasApprovedProposal && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Limit Reached</AlertTitle>
                    <AlertDescription>
                        You have used all 3 title slots (bids + proposals combined). Delete an existing bid to make room.
                    </AlertDescription>
                </Alert>
            )}

            {/* Lock Alerts */}
            {!hasGroup && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Group</AlertTitle>
                    <AlertDescription>
                        You must <a href="/mahasiswa/group" className="font-medium underline">create a group</a> first before proposing a title.
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

            {isPending && (
                <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Bid Pending</AlertTitle>
                    <AlertDescription>
                        Your group has a pending bid on <strong>{group?.title?.title}</strong>. Proposing is locked until the bid is resolved.
                    </AlertDescription>
                </Alert>
            )}

            {isWaitingProposal && !hasApprovedProposal && (
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

            {/* Proposal Form */}
            {showForm && canPropose && (
                <Card>
                    <form onSubmit={handleSubmit}>
                        <CardHeader>
                            <CardTitle>{editingProposal ? 'Resubmit Proposal' : 'New Title Proposal'}</CardTitle>
                            <CardDescription>
                                {editingProposal 
                                    ? 'Edit your proposal and resubmit for review.'
                                    : 'Fill in the details for your proposed title and select a supervisor.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Enter your proposed title"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe your project in detail"
                                    rows={3}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="problem_statement">Problem Statement</Label>
                                <Textarea
                                    id="problem_statement"
                                    value={formData.problem_statement}
                                    onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
                                    placeholder="What problem does your project solve?"
                                    rows={3}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="scope">Scope</Label>
                                <Textarea
                                    id="scope"
                                    value={formData.scope}
                                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                                    placeholder="Define the boundaries and scope of your project"
                                    rows={3}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Specializations</Label>
                                <div className="flex flex-wrap gap-3">
                                    {['Software', 'Embedded', 'Network', 'Multimedia', 'AI', 'Blockchain'].map(spec => (
                                        <label key={spec} className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox
                                                checked={formData.specializations.includes(spec)}
                                                onCheckedChange={() => setFormData(prev => ({
                                                    ...prev,
                                                    specializations: prev.specializations.includes(spec)
                                                        ? prev.specializations.filter(s => s !== spec)
                                                        : [...prev.specializations, spec],
                                                }))}
                                            />
                                            <span className="text-sm">{spec}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="supervisor">Supervisor (Dosen Pembimbing)</Label>
                                <Select
                                    value={formData.proposed_supervisor_id}
                                    onValueChange={(value) => setFormData({ ...formData, proposed_supervisor_id: value })}
                                    required
                                >
                                    <SelectTrigger>
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
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingProposal(null); }}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting || !formData.proposed_supervisor_id}>
                                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                {editingProposal ? 'Resubmit' : 'Submit Proposal'}
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
                                    Submitted: {new Date(proposal.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                            </CardContent>
                            {proposal.supervisor_approval_status === 'REJECTED' && !hasPendingProposal && canPropose && (
                                <CardFooter className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleResubmit(proposal)}>
                                        <RotateCcw className="mr-2 h-4 w-4" /> Edit & Resubmit
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
