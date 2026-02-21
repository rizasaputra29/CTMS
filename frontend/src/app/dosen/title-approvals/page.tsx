'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Check, X, User, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface Proposal {
    id: number;
    title: string;
    description: string;
    problem_statement: string | null;
    scope: string | null;
    supervisor_approval_status: string;
    proposed_by_group: {
        id: number;
        status: string;
        members: {
            id: number;
            is_leader: boolean;
            student: {
                id: number;
                name: string;
                email: string;
            };
        }[];
    } | null;
    proposed_supervisor: {
        id: number;
        name: string;
    } | null;
    created_at: string;
}

export default function TitleApprovalsPage() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const fetchProposals = async () => {
        try {
            const response = await api.get('/dosen/title-approvals');
            setProposals(response.data.data);
        } catch (error) {
            console.error('Failed to fetch proposals', error);
            toast.error('Failed to load title proposals');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProposals();
    }, []);

    const handleApprove = async (proposalId: number) => {
        setProcessing(true);
        try {
            await api.put(`/dosen/title-approvals/${proposalId}/approve`);
            toast.success('Proposal approved! Group has been finalized.');
            fetchProposals();
        } catch (error) {
            console.error('Failed to approve', error);
            toast.error('Failed to approve proposal');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedProposal || !rejectionReason.trim()) return;
        setProcessing(true);
        try {
            await api.put(`/dosen/title-approvals/${selectedProposal.id}/reject`, {
                rejection_reason: rejectionReason,
            });
            toast.success('Proposal rejected.');
            setRejectDialogOpen(false);
            setRejectionReason('');
            setSelectedProposal(null);
            fetchProposals();
        } catch (error) {
            console.error('Failed to reject', error);
            toast.error('Failed to reject proposal');
        } finally {
            setProcessing(false);
        }
    };

    const openRejectDialog = (proposal: Proposal) => {
        setSelectedProposal(proposal);
        setRejectionReason('');
        setRejectDialogOpen(true);
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
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Title Approvals</h1>
                <p className="text-muted-foreground">Review and approve student-proposed capstone titles.</p>
            </div>

            {proposals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-1">No pending proposals</p>
                    <p className="text-sm">Student proposals will appear here when submitted.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {proposals.map((proposal) => (
                        <Card key={proposal.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{proposal.title}</CardTitle>
                                        <CardDescription className="mt-1">
                                            Group #{proposal.proposed_by_group?.id} · Submitted {new Date(proposal.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Pending Review
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
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

                                {/* Group Members */}
                                {proposal.proposed_by_group && (
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold mb-2">Group Members</div>
                                        <div className="space-y-2">
                                            {proposal.proposed_by_group.members.map((member) => (
                                                <div key={member.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-md">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    <span>{member.student.name}</span>
                                                    <span className="text-muted-foreground text-xs">({member.student.email})</span>
                                                    {member.is_leader && <Badge variant="outline" className="text-xs">Leader</Badge>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex justify-end gap-2 border-t pt-4">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => openRejectDialog(proposal)}
                                    disabled={processing}
                                >
                                    <X className="mr-2 h-4 w-4" /> Reject
                                </Button>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="default" size="sm" disabled={processing}>
                                            <Check className="mr-2 h-4 w-4" /> Approve
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Approve this proposal?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will assign the title &quot;{proposal.title}&quot; to the group and finalize their project. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleApprove(proposal.id)}>
                                                Confirm Approve
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Proposal</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting &quot;{selectedProposal?.title}&quot;. The student will see this reason.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="rejection_reason">Rejection Reason</Label>
                            <Textarea
                                id="rejection_reason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Explain why this proposal is being rejected..."
                                rows={4}
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={processing || !rejectionReason.trim()}
                        >
                            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Reject Proposal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
