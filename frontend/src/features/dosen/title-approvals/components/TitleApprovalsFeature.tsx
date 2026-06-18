'use client';

import { Check, X, User, FileText, AlertTriangle, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/ui/loading';
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
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/utils';
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
        return <Loading variant="section" />;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Title Approvals"
                description="Review and approve student-proposed capstone titles."
                action={(
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
                )}
            />

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
                <EmptyState
                    icon={FileText}
                    title={searchQuery ? 'No matching proposals found' : 'No pending proposals'}
                    description={searchQuery ? 'Try adjusting your search query.' : 'Student proposals will appear here when submitted.'}
                />
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
                                            Group {proposal.proposed_by_group?.id} · Submitted {formatDate(proposal.created_at)}
                                        </CardDescription>
                                    </div>
                                    <StatusBadge
                                        status={proposal.supervisor_approval_status}
                                        category="proposal"
                                        className="flex items-center gap-1"
                                    >
                                        <AlertTriangle className="h-3 w-3" />
                                        {proposal.supervisor_approval_status === 'PENDING' ? 'Pending Review' : 'Pre-Approved'}
                                    </StatusBadge>
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
                                                    {member.is_leader && <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">Leader</span>}
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
                                    const minMembers = 3;
                                    const isPreApprove = (proposal.proposed_by_group?.members?.length ?? 0) < minMembers;
                                    const approveLabel = proposal.supervisor_approval_status === 'UNDER_REVIEW'
                                        ? 'Re-Approve'
                                        : isPreApprove
                                            ? 'Pre-Approve'
                                            : 'Approve';

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
                                                        {approveLabel}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>
                                                            {approveLabel} this proposal?
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {proposal.supervisor_approval_status === 'UNDER_REVIEW'
                                                                ? `This will Re-Approve the title "${proposal.title}" that was previously withdrawn. The title will return to the marketplace for member recruitment.`
                                                                : isPreApprove
                                                                    ? `This will Pre-Approve the title "${proposal.title}". The student must recruit more members to reach the minimum group size before it can be finalized.`
                                                                    : `This will approve the title "${proposal.title}" and prepare the group for admin finalization. This action cannot be undone.`
                                                            }
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleApprove(proposal.id)} disabled={!actions.can_approve}>
                                                            Confirm {approveLabel}
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
                            {processing ? <Loading variant="inline" className="mr-2" /> : null}
                            Reject Proposal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
