'use client';

import { Check, X, User, FileText, AlertTriangle, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { useTitleApprovals } from '../hooks/use-title-approvals';

const flowReasonMap: Record<string, string> = {
    PERIOD_FINALIZED: 'Periode sudah difinalisasi. Proposal tidak dapat diproses.',
};

export function TitleApprovalsFeature() {
    const {
        periods,
        selectedPeriod,
        searchQuery,
        loading,
        rejectDialogOpen,
        selectedProposal,
        rejectionReason,
        processing,
        proposalFlow,
        filteredProposals,
        setSearchQuery,
        setRejectDialogOpen,
        setRejectionReason,
        handlePeriodChange,
        handleApprove,
        handleReject,
        openRejectDialog,
    } = useTitleApprovals();

    const globalFlowMessage = proposalFlow?.reason ? flowReasonMap[proposalFlow.reason] || 'Aksi persetujuan proposal tidak tersedia.' : null;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Title Approvals</h1>
                    <p className="text-muted-foreground">Review and approve student-proposed capstone titles.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Periods" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Academic Period</SelectLabel>
                                <SelectItem value="all">All Periods</SelectItem>
                                {periods.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} {p.is_active && '(Active)'}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search titles, students, or groups..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
            </div>

            {globalFlowMessage && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {globalFlowMessage}
                </div>
            )}

            {filteredProposals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-1">{searchQuery ? 'No matching proposals found' : 'No pending proposals'}</p>
                    <p className="text-sm">{searchQuery ? 'Try adjusting your search query.' : 'Student proposals will appear here when submitted.'}</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {filteredProposals.map((proposal) => (
                        <Card key={proposal.id}>
                            {proposal.allowed_actions?.reason === 'PROPOSAL_ALREADY_PROCESSED' && (
                                <div className="mx-6 mt-6 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                    Proposal ini sudah diproses dan tidak dapat diubah.
                                </div>
                            )}
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{proposal.title}</CardTitle>
                                        <CardDescription className="mt-1">
                                            Group {proposal.proposed_by_group?.id} · Submitted {new Date(proposal.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </CardDescription>
                                    </div>
                                    <Badge variant={proposal.supervisor_approval_status === 'PENDING' ? 'secondary' : 'outline'} className="flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        {proposal.supervisor_approval_status === 'PENDING' ? 'Pending Review' : 'Pre-Approved'}
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
                                {(() => {
                                    const actions = proposal.allowed_actions ?? {
                                        can_approve: true,
                                        can_reject: true,
                                        reason: null,
                                    };

                                    return (
                                        <>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => openRejectDialog(proposal)}
                                                disabled={processing || !actions.can_reject}
                                            >
                                                <X className="mr-2 h-4 w-4" /> Reject
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="default" size="sm" disabled={processing}>
                                                        <Check className="mr-2 h-4 w-4" />
                                                        {proposal.supervisor_approval_status === 'UNDER_REVIEW' ? 'Re-Approve' : (proposal.proposed_by_group?.members?.length ?? 0) < 3 ? 'Pre-Approve' : 'Approve'}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>
                                                            {proposal.supervisor_approval_status === 'UNDER_REVIEW'
                                                                ? 'Re-Approve this proposal?'
                                                                : (proposal.proposed_by_group?.members?.length ?? 0) < 3 ? 'Pre-Approve this proposal?' : 'Approve this proposal?'}
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {proposal.supervisor_approval_status === 'UNDER_REVIEW'
                                                                ? `This will Re-Approve the title "${proposal.title}" that was previously withdrawn. The title will return to the marketplace for member recruitment.`
                                                                : (proposal.proposed_by_group?.members?.length ?? 0) < 3
                                                                ? `This will Pre-Approve the title "${proposal.title}". The student must recruit more members to reach the minimum group size before it can be finalized.`
                                                                : `This will approve the title "${proposal.title}" and prepare the group for admin finalization. This action cannot be undone.`
                                                            }
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleApprove(proposal.id)} disabled={!actions.can_approve}>
                                                            Confirm {proposal.supervisor_approval_status === 'UNDER_REVIEW' ? 'Re-Approve' : (proposal.proposed_by_group?.members?.length ?? 0) < 3 ? 'Pre-Approve' : 'Approve'}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </>
                                    );
                                })()}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

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
